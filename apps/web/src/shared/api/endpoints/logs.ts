import { api } from '@/shared/api/http'
import { Dayjs } from 'dayjs'

export type LogLevel = 'info' | 'warning' | 'error'

export type ClientInfo = {
  device: string
  os: string
  browser: string
  type: 'mobile' | 'tablet' | 'desktop' | 'bot' | 'unknown'
  label: string
}

export type LogEntry = {
  id: number
  log_type: string
  user_id?: number
  username?: string
  action: string
  resource: string
  message?: string
  details?: unknown
  ip_address: string
  user_agent: string
  client?: ClientInfo
  level: LogLevel | string
  status?: string
  created_at: string
}

export type LogFilters = {
  level: 'all' | LogLevel
  action?: string
  username?: string
  dateRange?: [Dayjs | null, Dayjs | null] | null
}

type ListResult = { items: LogEntry[]; total: number }

function parseList(payload: any): ListResult {
  let data = payload
  if (data && typeof data === 'object' && 'success' in data) data = data.data
  if (data && typeof data === 'object' && 'data' in data && !Array.isArray(data)) data = data.data

  if (Array.isArray(data)) return { items: data as LogEntry[], total: Number(payload?.total ?? data.length) }
  if (data && Array.isArray(data.items))
    return { items: data.items as LogEntry[], total: Number(data.total ?? data.items.length) }
  if (data && Array.isArray(data.logs))
    return { items: data.logs as LogEntry[], total: Number(data.total ?? data.logs.length) }
  return { items: [], total: 0 }
}

function toQuery(filters: LogFilters, page?: number, limit?: number) {
  return {
    page,
    limit,
    level: filters.level !== 'all' ? filters.level : undefined,
    action: filters.action || undefined,
    username: filters.username || undefined,
    start_date: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
    end_date: filters.dateRange?.[1]?.format('YYYY-MM-DD'),
  }
}

export const logsApi = {
  async list(filters: LogFilters, page = 1, limit = 20): Promise<ListResult> {
    const res = await api.get('/logs', { params: toQuery(filters, page, limit) })
    return parseList(res as any)
  },

  async listLogin(filters: LogFilters, page = 1, limit = 20): Promise<ListResult> {
    const res = await api.get('/logs/login', { params: toQuery(filters, page, limit) })
    return parseList(res as any)
  },

  async listAudit(filters: LogFilters, page = 1, limit = 20): Promise<ListResult> {
    const res = await api.get('/logs/audit', { params: toQuery(filters, page, limit) })
    return parseList(res as any)
  },

  async listSystem(filters: LogFilters, page = 1, limit = 20): Promise<ListResult> {
    const res = await api.get('/logs/system', { params: toQuery(filters, page, limit) })
    return parseList(res as any)
  },

  async exportCsv(filters: LogFilters) {
    const res = await api.get('/logs/export', {
      params: { ...toQuery(filters), format: 'csv' },
      responseType: 'blob' as any,
    })
    return (res as any)?.data ?? (res as unknown as Blob)
  },
}

export default logsApi
