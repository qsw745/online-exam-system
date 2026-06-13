/* eslint-disable @typescript-eslint/no-explicit-any */
import { AiLogRepository, type AiChatLogRow } from '../repositories/ai-log.repository'
import { AI_LOG_RETENTION_DAYS } from '@/config/ai'

type ChatRole = 'user' | 'assistant' | 'system'
export type ChatMessage = { role: ChatRole; content: string }

type ListQuery = {
  page?: number
  limit?: number
  keyword?: string
  model?: string
  sessionId?: string
  userId?: number
  startDate?: string
  endDate?: string
}

const MAX_MESSAGE_LEN = 4000
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000

let lastCleanupAt = 0

const toSqlDateTime = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ')

const clampDateRange = (startAt?: string, endAt?: string) => {
  const days = Number(AI_LOG_RETENTION_DAYS || 0)
  if (!Number.isFinite(days) || days <= 0) return { startAt, endAt }
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const cutoffStr = toSqlDateTime(cutoff)
  const nextStart = startAt && startAt > cutoffStr ? startAt : cutoffStr
  return { startAt: nextStart, endAt }
}

const parseDate = (value?: string, isEnd?: boolean) => {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const suffix = isEnd ? 'T23:59:59' : 'T00:00:00'
  const dt = new Date(`${trimmed}${trimmed.includes('T') ? '' : suffix}`)
  if (Number.isNaN(dt.getTime())) return undefined
  return toSqlDateTime(dt)
}

const normalizeMessages = (messages: any[]): ChatMessage[] =>
  (messages || [])
    .map(m => {
      const role = m?.role === 'assistant' || m?.role === 'system' ? m.role : 'user'
      const content = String(m?.content || '').slice(0, MAX_MESSAGE_LEN)
      return { role, content }
    })
    .filter(m => m.content.trim().length > 0)

const sanitizeAction = (action: any) => {
  if (!action || typeof action !== 'object') return undefined
  const type = typeof action.type === 'string' ? action.type : undefined
  if (!type) return undefined
  const payload = action.payload && typeof action.payload === 'object' ? { ...action.payload } : undefined
  if (payload) {
    delete (payload as any).password
    delete (payload as any).current
    delete (payload as any).next
    delete (payload as any).token
    delete (payload as any).api_key
    delete (payload as any).apiKey
  }
  return payload ? { type, payload } : { type }
}

const maskEmail = (value: string) => {
  const idx = value.indexOf('@')
  if (idx <= 0) return value
  const name = value.slice(0, idx)
  const domain = value.slice(idx + 1)
  const head = name.slice(0, 2)
  const tail = name.length > 2 ? name.slice(-1) : ''
  return `${head}***${tail}@${domain}`
}

export const maskSensitiveText = (text: string) => {
  let masked = text
  masked = masked.replace(
    /\b([A-Za-z0-9._%+-]{1,})@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g,
    (_all, name: string, domain: string) => maskEmail(`${name}@${domain}`)
  )
  masked = masked.replace(/\b1\d{10}\b/g, s => `${s.slice(0, 3)}****${s.slice(-4)}`)
  masked = masked.replace(/\b\d{17}[\dXx]\b/g, s => `${s.slice(0, 4)}**********${s.slice(-4)}`)
  return masked
}

const maskMessages = (messages: ChatMessage[]) =>
  messages.map(m => ({ ...m, content: maskSensitiveText(m.content) }))

const buildContentText = (messages: ChatMessage[]) =>
  messages.map(m => `[${m.role}] ${m.content}`).join('\n')

const buildPreview = (messages: ChatMessage[]) => {
  const lastUser = [...messages].reverse().find(m => m.role === 'user')
  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
  return {
    user: lastUser ? maskSensitiveText(lastUser.content).slice(0, 200) : '',
    assistant: lastAssistant ? maskSensitiveText(lastAssistant.content).slice(0, 200) : '',
  }
}

const parseMessages = (row: AiChatLogRow) => {
  if (!row?.messages_json) return []
  try {
    const parsed = JSON.parse(row.messages_json)
    return normalizeMessages(Array.isArray(parsed) ? parsed : [])
  } catch {
    return []
  }
}

const parseAction = (row: AiChatLogRow) => {
  if (!row?.action_json) return undefined
  try {
    return JSON.parse(row.action_json)
  } catch {
    return undefined
  }
}

const maskAction = (value: any): any => {
  if (typeof value === 'string') return maskSensitiveText(value)
  if (Array.isArray(value)) return value.map(maskAction)
  if (value && typeof value === 'object') {
    const next: Record<string, any> = {}
    Object.keys(value).forEach(k => {
      next[k] = maskAction(value[k])
    })
    return next
  }
  return value
}

export class AiLogService {
  static async recordAgentTurn(input: {
    userId: number
    sessionId?: string | null
    model?: string | null
    messages: ChatMessage[]
    action?: any
  }) {
    const messages = normalizeMessages(input.messages)
    if (!messages.length) return
    const action = sanitizeAction(input.action)
    await AiLogRepository.insert({
      userId: input.userId,
      sessionId: input.sessionId ?? null,
      model: input.model ?? null,
      messagesJson: JSON.stringify(messages),
      contentText: buildContentText(messages),
      actionJson: action ? JSON.stringify(action) : null,
    })
    await AiLogService.cleanupExpired()
  }

  static async listLogs(
    user: { id?: number; role?: string; isAdmin?: boolean } | undefined,
    query: ListQuery
  ) {
    const page = Math.max(1, Number(query.page || 1))
    const limit = Math.min(50, Math.max(10, Number(query.limit || 20)))
    const isAdmin = !!(user?.isAdmin || user?.role === 'admin' || user?.role === 'super_admin')

    const startAt = parseDate(query.startDate)
    const endAt = parseDate(query.endDate, true)
    const retention = clampDateRange(startAt, endAt)

    const filter = {
      userId: isAdmin ? query.userId : user?.id,
      isAdmin,
      model: query.model,
      keyword: query.keyword,
      sessionId: query.sessionId,
      startAt: retention.startAt,
      endAt: retention.endAt,
      limit,
      offset: (page - 1) * limit,
    }

    const [rows, total] = await Promise.all([AiLogRepository.list(filter), AiLogRepository.count(filter)])

    const items = rows.map(row => {
      const messages = parseMessages(row)
      const maskedMessages = maskMessages(messages)
      return {
        id: row.id,
        userId: row.user_id,
        nickname: row.nickname || '',
        email: row.email || '',
        sessionId: row.session_id || '',
        model: row.model || '',
        createdAt: row.created_at,
        preview: buildPreview(messages),
        messages: maskedMessages,
        action: maskAction(parseAction(row)),
      }
    })

    return { items, total, page, limit }
  }

  static async exportJsonl(
    user: { id?: number; role?: string; isAdmin?: boolean } | undefined,
    query: ListQuery
  ) {
    const isAdmin = !!(user?.isAdmin || user?.role === 'admin' || user?.role === 'super_admin')
    const startAt = parseDate(query.startDate)
    const endAt = parseDate(query.endDate, true)
    const retention = clampDateRange(startAt, endAt)

    const filter = {
      userId: isAdmin ? query.userId : user?.id,
      isAdmin,
      model: query.model,
      keyword: query.keyword,
      sessionId: query.sessionId,
      startAt: retention.startAt,
      endAt: retention.endAt,
    }

    const rows = await AiLogRepository.exportList(filter)
    return rows
      .map(row => {
        const messages = parseMessages(row)
        if (!messages.length) return ''
        const maskedMessages = maskMessages(messages)
        return JSON.stringify({ messages: maskedMessages })
      })
      .filter(Boolean)
  }

  static async cleanupExpired() {
    const days = Number(AI_LOG_RETENTION_DAYS || 0)
    if (!Number.isFinite(days) || days <= 0) return
    const now = Date.now()
    if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return
    lastCleanupAt = now
    const cutoff = toSqlDateTime(new Date(now - days * 24 * 60 * 60 * 1000))
    await AiLogRepository.cleanupBefore(cutoff)
  }
}
