/* eslint-disable @typescript-eslint/no-explicit-any */
import { Queue, Worker, type Job } from 'bullmq'
import IORedis, { type RedisOptions } from 'ioredis'
import { redis } from '@/common/redis/client'
import { AiService } from './ai.service'
import { QuestionService } from '@/modules/questions/services/question.service'
import { computeQuestionContentSignature } from '@/modules/questions/utils/content-hash'
import { AI_JOB_CONCURRENCY, AI_QUESTION_BATCH_MAX, AI_QUESTION_BATCH_SIZE, AI_QUESTION_MAX_REQUESTS } from '@/config/ai'

declare const process: any

const {
  REDIS_URL,
  REDIS_HOST = '127.0.0.1',
  REDIS_PORT = '6379',
  REDIS_PASSWORD = '',
  REDIS_DB = '0',
  REDIS_PREFIX = '',
} = process.env as Record<string, string | undefined>

const queueName = 'ai-question-generate'
const queuePrefix = (REDIS_PREFIX || '').replace(/:+$/, '')

const baseCommon = {
  lazyConnect: true,
  enableReadyCheck: true,
  maxRetriesPerRequest: null,
  retryStrategy(times: number) {
    const delay = Math.min(2000, 100 + times * 100)
    return delay
  },
} satisfies Partial<RedisOptions>

const base: RedisOptions = REDIS_URL
  ? (baseCommon as RedisOptions)
  : ({
      ...baseCommon,
      host: REDIS_HOST,
      port: Number(REDIS_PORT),
      password: REDIS_PASSWORD || undefined,
      db: Number(REDIS_DB) || 0,
    } as RedisOptions)

const bullConnection = REDIS_URL ? new IORedis(REDIS_URL, base) : new IORedis(base)
const qsvc = new QuestionService()

type JobPayload = {
  payload: any
  user?: { id?: number; email?: string }
}

export const questionQueue = new Queue<JobPayload>(queueName, {
  connection: bullConnection as any,
  prefix: queuePrefix ? `${queuePrefix}:bull` : 'bull',
})

const clampBatch = (n: number) => Math.max(5, Math.min(AI_QUESTION_BATCH_MAX, n))
const MIN_BATCH = 3
const EXTRA_RETRIES_ON_DUP = 6
// 重试预算上限倍数：模型重复率高时（大批量同主题）需要远多于理论批次数的请求才能凑满目标量
const MAX_REQUESTS_MULTIPLIER = 4
// 传给模型的"已生成题干"上限与单条截断长度（控制 prompt 体积）
const AVOID_TITLES_MAX = 60
const AVOID_TITLE_LEN = 40

// —— 预览暂存：persist=false 生成的题目按用户暂存 2 小时，供"保存入库"动作直接落库 ——
const PREVIEW_TTL_SEC = 2 * 3600
const previewKeyOf = (userId: number | string) => `ai:qpreview:${userId}`

export type PreviewStash = {
  questions: any[]
  subject?: string
  savedAt: string
}

export async function getPreviewStash(userId: number | string): Promise<PreviewStash | null> {
  const raw = await redis.get(previewKeyOf(userId))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as PreviewStash
    return Array.isArray(parsed?.questions) && parsed.questions.length ? parsed : null
  } catch {
    return null
  }
}

async function setPreviewStash(userId: number | string, stash: PreviewStash): Promise<void> {
  await redis.set(previewKeyOf(userId), JSON.stringify(stash), 'EX', PREVIEW_TTL_SEC)
}

async function clearPreviewStash(userId: number | string): Promise<void> {
  await redis.del(previewKeyOf(userId))
}
const isAbortError = (err: any) => {
  const msg = String(err?.message || err || '').toLowerCase()
  return msg.includes('aborted') || msg.includes('aborterror') || msg.includes('timeout')
}
const isDuplicateError = (err: any) => {
  const msg = String(err?.message || err || '')
  return msg.includes('重复') || msg.includes('相同题干') || msg.includes('内容相同')
}

const toCount = (v: any, fallback = 5) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

// 单题入库：返回结果类别，去重集合与错误列表由调用方持有
async function persistQuestionItem(
  user: JobPayload['user'],
  item: any,
  seenHashes: Set<string>,
  errors: Array<{ error?: string; item?: any }>
): Promise<'created' | 'duplicate' | 'failed'> {
  try {
    const questionType = String(item?.question_type || '')
    const content = String(item?.content || '')
    if (!questionType || !content) {
      errors.push({ error: 'invalid_question', item })
      return 'failed'
    }
    const { hash } = computeQuestionContentSignature(questionType, content)
    if (seenHashes.has(hash)) return 'duplicate'
    seenHashes.add(hash)
    const payload = {
      title: item?.title,
      content: item?.content,
      question_type: item?.question_type,
      options: item?.options,
      correct_answer: item?.correct_answer,
      knowledge_points: item?.knowledge_points,
      tags: item?.tags,
      explanation: item?.explanation,
      difficulty: item?.difficulty,
    }
    const data = await qsvc.create(user, payload, { ip: 'ai-job', ua: 'ai-job' })
    return data?.question ? 'created' : 'failed'
  } catch (err: any) {
    if (isDuplicateError(err)) return 'duplicate'
    errors.push({ error: err?.message || 'create_failed', item })
    return 'failed'
  }
}

// "保存预览"任务：把暂存的预览题目批量入库（不再调用大模型）
async function persistPreviewJob(job: Job<JobPayload>) {
  const userId = job.data?.user?.id
  if (!userId) throw new Error('缺少用户信息，无法保存预览题目')
  const stash = await getPreviewStash(userId)
  if (!stash) throw new Error('没有可保存的预览题目（可能已过期），请重新生成')

  const list = stash.questions
  const total = list.length
  const seenHashes = new Set<string>()
  const errors: Array<{ error?: string; item?: any }> = []
  let created = 0
  let duplicate = 0

  for (let i = 0; i < list.length; i++) {
    const outcome = await persistQuestionItem(job.data.user, list[i], seenHashes, errors)
    if (outcome === 'created') created += 1
    else if (outcome === 'duplicate') duplicate += 1
    if ((i + 1) % 10 === 0 || i === list.length - 1) {
      await job.updateProgress({ stage: 'persist', current: i + 1, total, generated: total, created })
    }
  }

  await clearPreviewStash(userId)
  return { generatedCount: total, createdCount: created, duplicateCount: duplicate, errors }
}

async function processJob(job: Job<JobPayload>) {
  const input = job.data?.payload || {}
  if (input.mode === 'persist_preview') return persistPreviewJob(job)
  const total = toCount(input.count, 5)
  const persist = !!input.persist
  const batchSize = clampBatch(Number(input.batch_size ?? AI_QUESTION_BATCH_SIZE))
  let preferSingle =
    input.single_request === true ? true : input.single_request === false ? false : total <= batchSize
  const requiredRequests = Math.max(1, Math.ceil(total / batchSize))
  let maxRequests = Math.max(requiredRequests, Math.max(1, Number(input.max_requests ?? AI_QUESTION_MAX_REQUESTS)))
  let currentBatch = batchSize

  let generatedTotal = 0
  let createdTotal = 0
  let duplicateTotal = 0
  let noProgressStreak = 0
  const seenHashes = new Set<string>()
  const errors: Array<{ error?: string; item?: any }> = []
  // 预览模式暂存生成结果；同时记录已生成题干喂回模型避免跨批重复
  const previewList: any[] = []
  const recentTitles: string[] = []

  const runOnce = async (count: number, stageIndex: number, stageTotal: number) => {
    await job.updateProgress({
      stage: 'generate',
      current: stageIndex,
      total: stageTotal,
      // 预览模式上报去重后的有效数，避免"已生成 520/500"的错觉
      generated: persist ? generatedTotal : previewList.length,
      created: createdTotal,
    })

    const generated = await AiService.generateQuestions({
      ...input,
      count,
      existing_titles: recentTitles.slice(-AVOID_TITLES_MAX),
      batch_index: stageIndex,
    })
    const questions = (generated?.data as any)?.questions
    const rejected = Array.isArray((generated?.data as any)?.rejected_questions)
      ? (generated?.data as any).rejected_questions
      : []
    const list = Array.isArray(questions) ? questions : []
    for (const item of rejected) {
      errors.push({
        error: Array.isArray(item?.issues) ? item.issues.join('；') : 'question_quality_failed',
        item: item?.item,
      })
    }
    generatedTotal += list.length
    // 模型输出没解析出题目：显式记错，不再静默"无进展"结束
    if (!list.length) {
      const rawPreview = String((generated as any)?.raw || '').slice(0, 120)
      errors.push({ error: `ai_output_unparsable_or_empty: ${rawPreview}` })
    }
    for (const item of list) {
      const title = String(item?.content || item?.title || '').slice(0, AVOID_TITLE_LEN)
      if (title) recentTitles.push(title)
    }

    let createdThisRun = 0
    let duplicateThisRun = 0
    let failedThisRun = 0

    if (persist && list.length) {
      for (const item of list) {
        const outcome = await persistQuestionItem(job.data.user, item, seenHashes, errors)
        if (outcome === 'created') {
          createdTotal += 1
          createdThisRun += 1
        } else if (outcome === 'duplicate') {
          duplicateThisRun += 1
        } else {
          failedThisRun += 1
        }
      }
    } else if (!persist && list.length) {
      // 预览模式：批内按内容签名去重后暂存，供后续"保存入库"
      for (const item of list) {
        if (previewList.length >= total) break
        const questionType = String(item?.question_type || '')
        const content = String(item?.content || '')
        if (!questionType || !content) continue
        const { hash } = computeQuestionContentSignature(questionType, content)
        if (seenHashes.has(hash)) {
          duplicateThisRun += 1
          continue
        }
        seenHashes.add(hash)
        previewList.push(item)
        createdThisRun += 1
      }
    }

    duplicateTotal += duplicateThisRun
    return { createdThisRun, duplicateThisRun, failedThisRun, generatedCount: list.length }
  }

  let attempts = 0
  let remaining = total
  while (remaining > 0 && attempts < maxRequests) {
    const count = preferSingle ? remaining : Math.min(remaining, currentBatch)
    const before = remaining
    let err: any = null
    let runResult: { createdThisRun: number; duplicateThisRun: number; failedThisRun: number; generatedCount: number } | null =
      null
    try {
      runResult = await runOnce(count, attempts + 1, maxRequests)
    } catch (e: any) {
      err = e
      errors.push({ error: e?.message || 'request_failed' })
    }
    attempts += 1

    if (err && isAbortError(err) && count > MIN_BATCH) {
      if (preferSingle) preferSingle = false
      currentBatch = Math.max(MIN_BATCH, Math.floor(count / 2))
      const newRequired = Math.max(1, Math.ceil(total / currentBatch))
      if (newRequired > maxRequests) maxRequests = newRequired
      continue
    }

    if (runResult?.createdThisRun) {
      noProgressStreak = 0
    } else {
      noProgressStreak += 1
    }

    // 重复率高时逐步追加请求预算，上限放宽到理论批次数的数倍——
    // 大批量同主题生成时模型重复率可达 50%+，旧上限（理论批次+6）会在凑满前耗尽
    const hardCap = requiredRequests * MAX_REQUESTS_MULTIPLIER + EXTRA_RETRIES_ON_DUP
    if (runResult?.duplicateThisRun && maxRequests < hardCap) {
      maxRequests += 1
    }

    const nextRemaining = persist ? Math.max(0, total - createdTotal) : Math.max(0, total - previewList.length)
    if (nextRemaining >= before) {
      remaining = nextRemaining
      if (noProgressStreak >= 2 && !(runResult?.duplicateThisRun || err)) break
      continue
    }
    remaining = nextRemaining
  }

  // 预览模式：结果暂存 2 小时，用户确认"保存"后由 persist_preview 任务直接入库，不再重新生成
  const userId = job.data?.user?.id
  let previewSaved = false
  if (!persist && previewList.length && userId) {
    await setPreviewStash(userId, {
      questions: previewList,
      subject: typeof input.subject === 'string' ? input.subject : undefined,
      savedAt: new Date().toISOString(),
    })
    previewSaved = true
  }

  const finalTotal = Math.max(1, attempts || 1)
  await job.updateProgress({
    stage: 'done',
    current: finalTotal,
    total: finalTotal,
    generated: persist ? generatedTotal : previewList.length,
    created: createdTotal,
  })

  return {
    generatedCount: persist ? generatedTotal : previewList.length,
    createdCount: createdTotal,
    duplicateCount: duplicateTotal,
    previewSaved,
    previewCount: previewList.length,
    errors,
  }
}

let workerStarted = false

export function ensureQuestionWorker() {
  if (workerStarted) return
  workerStarted = true
  // eslint-disable-next-line no-new
  new Worker<JobPayload>(queueName, processJob, {
    connection: bullConnection as any,
    concurrency: Math.max(1, AI_JOB_CONCURRENCY),
    prefix: queuePrefix ? `${queuePrefix}:bull` : 'bull',
  })
}

export async function enqueueQuestionJob(payload: any, user?: { id?: number; email?: string }) {
  const job = await questionQueue.add(
    'generate',
    { payload, user },
    {
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 200 },
    }
  )
  return job
}

export async function getQuestionJob(jobId: string) {
  const job = await questionQueue.getJob(jobId)
  return job
}
