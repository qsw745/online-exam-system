import { api } from '../core/httpClient'
import type { Dayjs } from 'dayjs'

export type LearningStats = {
  total_study_time: number
  questions_practiced: number
  correct_rate: number
  streak_days: number
  subjects_studied: number
  avg_score: number
}

export type ProgressRecord = {
  id: number
  subject: string
  questions_count: number
  correct_count: number
  study_time: number
  created_at: string
}

type ApiSuccess<T = any> = { success: true; data: T; message?: string }
const isSuccess = <T>(r: any): r is ApiSuccess<T> => r && r.success === true

function pickArray<T = any>(res: any, fallback: T[] = []): T[] {
  const d = res?.data
  if (Array.isArray(d)) return d as T[]
  if (Array.isArray(d?.data)) return d.data as T[]
  if (Array.isArray(d?.items)) return d.items as T[]
  if (Array.isArray(d?.records)) return d.records as T[]
  if (Array.isArray(d?.subjects)) return d.subjects as T[]
  return fallback
}
function pickObject<T = any>(res: any, fallback: T | null = null): T | null {
  const d = res?.data
  if (d && typeof d === 'object') return d as T
  if (d?.data && typeof d.data === 'object') return d.data as T
  return fallback
}

export const learningProgressApi = {
  async getStats(params: { start?: Dayjs | null; end?: Dayjs | null; subject?: string }) {
    const query: any = {
      start_date: params.start?.format('YYYY-MM-DD'),
      end_date: params.end?.format('YYYY-MM-DD'),
      subject: params.subject && params.subject !== 'all' ? params.subject : undefined,
    }
    const res = await api.get('/learning-progress/stats', { params: query })
    const obj = pickObject<any>(res, {}) || {}
    const stats: LearningStats = obj.stats ?? {
      total_study_time: Number(obj.total_study_time ?? 0),
      questions_practiced: Number(obj.questions_practiced ?? 0),
      correct_rate: Number(obj.correct_rate ?? 0),
      streak_days: Number(obj.streak_days ?? 0),
      subjects_studied: Number(obj.subjects_studied ?? 0),
      avg_score: Number(obj.avg_score ?? 0),
    }
    return stats
  },

  async getRecords(params: { start?: Dayjs | null; end?: Dayjs | null; subject?: string; limit?: number }) {
    const query: any = {
      start_date: params.start?.format('YYYY-MM-DD'),
      end_date: params.end?.format('YYYY-MM-DD'),
      subject: params.subject && params.subject !== 'all' ? params.subject : undefined,
      limit: params.limit ?? 20,
    }
    const res = await api.get('/learning-progress/records', { params: query })
    const list = pickArray<ProgressRecord>(res, [])
    return list
  },

  async getSubjects() {
    const res = await api.get('/learning-progress/subjects')
    return pickArray<string>(res, [])
  },
}
export default learningProgressApi
