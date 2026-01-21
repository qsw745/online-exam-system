import { api } from '../core/httpClient'

export type ProctoringSeverity = 'info' | 'warn' | 'critical'

export type ProctoringEvent = {
  id: number
  exam_id: number
  user_id: number
  severity: ProctoringSeverity
  type: string
  message: string | null
  meta?: any
  occurred_at?: string | null
  created_at: string
}

export type ProctoringSummary = {
  total: number
  info: number
  warn: number
  critical: number
}

export type ProctoringList = {
  items: ProctoringEvent[]
  total: number
  page: number
  limit: number
  summary: ProctoringSummary
}

function unwrap(res: any): any {
  if (!res) return res
  if (typeof res === 'object') {
    if ('ok' in res) {
      if (res.ok) return res.data ?? res.result ?? res.payload ?? {}
      throw new Error(res?.message || '请求失败')
    }
    if ('data' in res) return (res as any).data
  }
  return res
}

export const proctoringApi = {
  reportEvent: (payload: {
    examId: number
    taskId?: number
    type: string
    severity?: ProctoringSeverity
    message?: string
    meta?: any
    occurredAt?: string
    source?: string
  }) => api.post('/proctoring/events', payload),

  async listExamEvents(examId: string | number, params?: { page?: number; limit?: number; severity?: string }) {
    const res = await api.get(`/proctoring/exams/${examId}`, { params })
    const payload = unwrap(res)
    const items = payload?.items ?? payload?.data?.items ?? []
    const summary = payload?.summary ?? payload?.data?.summary ?? { total: 0, info: 0, warn: 0, critical: 0 }
    return {
      items,
      summary,
      total: Number(payload?.total ?? items.length ?? 0),
      page: Number(payload?.page ?? 1),
      limit: Number(payload?.limit ?? items.length ?? 10),
    } as ProctoringList
  },
}

export default proctoringApi
