import { api } from '../core/httpClient'
import type { Dayjs } from 'dayjs'

export type LearningStats = { total_study_time: number; questions_practiced: number; correct_answers: number;
  correct_rate: number; study_days: number; subjects_studied: number }
export type ProgressRecord = { id: number; subject: string; questions_count: number; correct_count: number; study_time: number; created_at: string }
export type LearningSubject = { id: string; name: string }
type Filters = { start?: Dayjs | null; end?: Dayjs | null; subject?: string }
const count = (value: unknown) => { const n = Number(value ?? 0); return Number.isFinite(n) ? Math.max(0, n) : 0 }
function payload(result: any) {
  if (!result?.success) throw new Error(result?.error || '学习数据加载失败，请重试')
  return result.data?.data ?? result.data
}
function list(data: any, field: string): any[] {
  const values = Array.isArray(data) ? data : data?.[field] ?? data?.items
  if (!Array.isArray(values)) throw new Error('学习数据不完整，请重试')
  return values
}
const query = (filters: Filters) => ({ start_date: filters.start?.format('YYYY-MM-DD'), end_date: filters.end?.format('YYYY-MM-DD') })

export const learningProgressApi = {
  async getStats(filters: Filters): Promise<LearningStats> {
    const data = payload(await api.get('/learning-progress/stats', { params: {
      ...query(filters), period: 'all', subjectId: filters.subject && filters.subject !== 'all' ? filters.subject : undefined,
    } }))
    const stats = data?.totalStats ?? data?.stats ?? data
    if (!stats || typeof stats !== 'object' || !('total_study_time' in stats)) throw new Error('学习统计数据不完整，请重试')
    const total = count(stats.total_questions ?? stats.questions_practiced)
    const correct = Math.min(total, count(stats.correct_answers))
    return { total_study_time: count(stats.total_study_time), questions_practiced: total, correct_answers: correct,
      correct_rate: total ? correct / total * 100 : 0, study_days: count(stats.study_days), subjects_studied: count(stats.subjects_studied) }
  },
  async getRecords(filters: Filters & { limit?: number }): Promise<ProgressRecord[]> {
    const data = payload(await api.get('/learning-progress/records', { params: { ...query(filters),
      subject: filters.subject && filters.subject !== 'all' ? filters.subject : undefined, limit: filters.limit ?? 20 } }))
    return list(data, 'records').map(record => ({ ...record, id: Number(record.id),
      subject: record.subject == null ? '未分类' : String(record.subject),
      questions_count: count(record.questions_count), correct_count: Math.min(count(record.questions_count), count(record.correct_count)),
      study_time: count(record.study_time) }))
  },
  async getSubjects(): Promise<LearningSubject[]> {
    const data = payload(await api.get('/learning-progress/subjects'))
    return list(data, 'subjects').map(subject => typeof subject === 'string' ? { id: subject, name: subject } : { id: String(subject.id), name: String(subject.name) })
  },
}
export default learningProgressApi
