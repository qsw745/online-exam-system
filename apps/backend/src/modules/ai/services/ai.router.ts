import { ResultService } from '@/modules/exams/services/result.service'
import { get as cacheGet, set as cacheSet } from '@/common/redis/cache'

const resultSvc = new ResultService()

type PendingSummaryItem = { id: number; title: string; score?: number; total?: number; end_time?: string | null }

const PENDING_TTL_SEC = 600
const pendingKey = (userId: number) => `ai:pending:summary:${userId}`

const setPending = async (userId: number, items: PendingSummaryItem[]) =>
  cacheSet(pendingKey(userId), JSON.stringify(items), PENDING_TTL_SEC)

const getPending = async (userId: number): Promise<PendingSummaryItem[] | null> => {
  const raw = await cacheGet(pendingKey(userId))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as PendingSummaryItem[]) : null
  } catch {
    return null
  }
}

const extractExplicitId = (text: string): number | null => {
  const m = text.match(/(?:^|\b)(?:id|ID)?\s*(\d{1,8})\b/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

const isPureNumber = (text: string): number | null => {
  const s = text.trim()
  if (!/^\d{1,8}$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const fmtTime = (v?: string | null) => {
  if (!v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const summarizeIntent = (text: string) => /总结|分析|报告|复盘|成绩|表现/.test(text)

const wantLatest = (text: string) => /最近|最新|上一场|上次/.test(text)

export async function routeAgent(input: {
  user?: { id?: number; role?: string }
  message: string
}): Promise<{ reply: string; action?: { type: string; payload?: any } } | null> {
  const text = String(input.message || '').trim()
  if (!text) return null

  if (/你好|您好|哈喽|嗨|在吗/.test(text)) {
    return {
      reply:
        '你好！我可以帮你查找功能、生成题目、总结考试、制定学习计划等。你也可以直接说“帮我总结最近一次考试”。',
    }
  }

  if (/你是谁|你是啥|你是什么|模型|大模型|能做什么|功能|怎么用/.test(text)) {
    return {
      reply:
        '我是在线考试系统内置的 AI 助手，可帮你：总结考试/解析题目/生成题目/制定学习计划/发送站内信等。你可以直接描述需求，我会尽量一步到位。',
    }
  }

  if (!summarizeIntent(text)) return null
  const userId = input.user?.id
  if (!userId) return { reply: '请先登录后再查看考试总结。' }

  const explicitId = extractExplicitId(text)
  if (explicitId) {
    return {
      reply: `好的，正在生成考试总结（结果ID ${explicitId}）。`,
      action: { type: 'summarize_exam', payload: { exam_result_id: explicitId } },
    }
  }

  const pureId = isPureNumber(text)
  if (pureId) {
    const pending = await getPending(userId)
    if (pending?.length) {
      const hit = pending.find(p => p.id === pureId) || pending[pureId - 1]
      if (hit) {
        return {
          reply: `好的，正在生成考试总结（结果ID ${hit.id}）。`,
          action: { type: 'summarize_exam', payload: { exam_result_id: hit.id } },
        }
      }
    }
  }

  const data = await resultSvc.list(input.user, { page: 1, limit: 3, sort: 'end_time', status: 'submitted' })
  const list = (data?.results || []).map((r: any) => ({
    id: Number(r.id),
    title: String(r.paper_title || `考试${r.exam_id || r.id}`),
    score: Number(r.score || 0),
    total: Number(r.total_score || 0),
    end_time: r.end_time || null,
  }))

  if (!list.length) return { reply: '暂无已提交的考试结果，完成考试后我可以帮你总结。' }

  if (wantLatest(text)) {
    const pick = list[0]
    return {
      reply: `好的，正在生成最近一次考试总结（结果ID ${pick.id}）。`,
      action: { type: 'summarize_exam', payload: { exam_result_id: pick.id } },
    }
  }

  await setPending(userId, list)
  const lines = list
    .map(
      (r, idx) =>
        `${idx + 1}) [ID ${r.id}] ${r.title}  ${r.score}/${r.total}  ${fmtTime(r.end_time)}`
    )
    .join('\n')
  return {
    reply: `我找到了你最近的考试结果，请回复序号或ID（如：1 或 ID ${list[0].id}）：\n${lines}`,
  }
}
