/* eslint-disable @typescript-eslint/no-explicit-any */
import { Queue, Worker, type Job } from 'bullmq'
import IORedis, { type RedisOptions } from 'ioredis'
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

async function processJob(job: Job<JobPayload>) {
  const input = job.data?.payload || {}
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

  const runOnce = async (count: number, stageIndex: number, stageTotal: number) => {
    await job.updateProgress({
      stage: 'generate',
      current: stageIndex,
      total: stageTotal,
      generated: generatedTotal,
      created: createdTotal,
    })

    const generated = await AiService.generateQuestions({ ...input, count })
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

    let createdThisRun = 0
    let duplicateThisRun = 0
    let failedThisRun = 0

    if (persist && list.length) {
      for (const item of list) {
        try {
          const questionType = String(item?.question_type || '')
          const content = String(item?.content || '')
          if (!questionType || !content) {
            failedThisRun += 1
            errors.push({ error: 'invalid_question', item })
            continue
          }
          const { hash } = computeQuestionContentSignature(questionType, content)
          if (seenHashes.has(hash)) {
            duplicateThisRun += 1
            continue
          }
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
          const data = await qsvc.create(job.data.user, payload, { ip: 'ai-job', ua: 'ai-job' })
          if (data?.question) {
            createdTotal += 1
            createdThisRun += 1
          }
        } catch (err: any) {
          const message = err?.message || 'create_failed'
          if (isDuplicateError(err)) {
            duplicateThisRun += 1
          } else {
            failedThisRun += 1
          }
          errors.push({ error: message, item })
        }
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

    if (runResult?.duplicateThisRun && attempts < maxRequests + EXTRA_RETRIES_ON_DUP) {
      const cap = Math.max(maxRequests, requiredRequests + EXTRA_RETRIES_ON_DUP)
      if (maxRequests < cap) maxRequests += 1
    }

    const nextRemaining = persist ? Math.max(0, total - createdTotal) : Math.max(0, total - generatedTotal)
    if (nextRemaining >= before) {
      remaining = nextRemaining
      if (noProgressStreak >= 2 && !(runResult?.duplicateThisRun || err)) break
      continue
    }
    remaining = nextRemaining
  }

  const finalTotal = Math.max(1, attempts || 1)
  await job.updateProgress({
    stage: 'done',
    current: finalTotal,
    total: finalTotal,
    generated: generatedTotal,
    created: createdTotal,
  })

  return {
    generatedCount: generatedTotal,
    createdCount: createdTotal,
    duplicateCount: duplicateTotal,
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
