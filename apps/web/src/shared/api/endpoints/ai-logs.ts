import { api } from '@/shared/api/http'
import type { Dayjs } from 'dayjs'

export type AiLogMessage = { role: 'user' | 'assistant' | 'system'; content: string }

export type AiLogItem = {
  id: number
  userId: number
  nickname: string
  email: string
  sessionId: string
  model: string
  createdAt: string
  preview?: { user?: string; assistant?: string }
  messages?: AiLogMessage[]
  action?: { type: string; payload?: any }
}

export type AiLogFilters = {
  keyword?: string
  model?: string
  sessionId?: string
  userId?: number
  dateRange?: [Dayjs | null, Dayjs | null] | null
}

type ListResult = { items: AiLogItem[]; total: number; page: number; limit: number }

const toQuery = (filters: AiLogFilters, page?: number, limit?: number) => ({
  page,
  limit,
  keyword: filters.keyword || undefined,
  model: filters.model || undefined,
  session_id: filters.sessionId || undefined,
  user_id: filters.userId || undefined,
  start_date: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
  end_date: filters.dateRange?.[1]?.format('YYYY-MM-DD'),
})

function parseList(payload: any): ListResult {
  let data = payload
  if (data && typeof data === 'object' && 'success' in data) data = data.data
  if (data && typeof data === 'object' && 'data' in data && !Array.isArray(data)) data = data.data
  if (!data || typeof data !== 'object') return { items: [], total: 0, page: 1, limit: 20 }

  const items = Array.isArray(data.items) ? (data.items as AiLogItem[]) : []
  const total = Number(data.total ?? items.length)
  const page = Number(data.page ?? 1)
  const limit = Number(data.limit ?? 20)
  return { items, total, page, limit }
}

export const aiLogsApi = {
  async list(filters: AiLogFilters, page = 1, limit = 20): Promise<ListResult> {
    const res = await api.get('/ai/logs', { params: toQuery(filters, page, limit) })
    return parseList(res as any)
  },
  async exportJsonl(filters: AiLogFilters) {
    const res = await api.get('/ai/logs/export', {
      params: toQuery(filters),
      responseType: 'blob' as any,
    })
    return (res as any)?.data ?? (res as unknown as Blob)
  },
}

export default aiLogsApi
