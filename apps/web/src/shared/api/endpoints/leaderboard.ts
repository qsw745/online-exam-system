import { api } from '../core/httpClient'
import dayjs, { Dayjs } from 'dayjs'

export interface LeaderboardEntry {
  id: number
  user_id: number
  username: string
  avatar?: string
  score: number
  rank: number
  total_questions: number
  correct_questions: number
  study_time: number
  streak_days: number
}

export interface LeaderboardStats {
  total_participants: number
  avg_score: number
  top_score: number
  my_rank?: number
}

type ApiSuccess<T = any> = { success: true; data: T; message?: string }
const isSuccess = <T>(r: any): r is ApiSuccess<T> => r && r.success === true

function pickArray<T = any>(res: any, fallback: T[] = []): T[] {
  const d = res?.data
  if (Array.isArray(d)) return d as T[]
  if (Array.isArray(d?.data)) return d.data as T[]
  if (Array.isArray(d?.leaderboards)) return d.leaderboards as T[]
  if (Array.isArray(d?.records)) return d.records as T[]
  if (Array.isArray(d?.items)) return d.items as T[]
  return fallback
}
function pickObject<T = any>(res: any, fallback: T | null = null): T | null {
  const d = res?.data
  if (d && typeof d === 'object') return d as T
  if (d?.data && typeof d.data === 'object') return d.data as T
  return fallback
}

export const leaderboardApi = {
  async listLeaderboards(params: { category?: string; type?: string; active?: boolean } = {}) {
    const res = await api.get('/leaderboard', { params })
    // 兼容后端可能返回 {leaderboards: []} 或 直接 []
    return pickArray<{ id: number; name: string }>(res, [])
  },

  async getLeaderboard(
    id: number,
    opts?: {
      subject?: string
      start?: Dayjs | null
      end?: Dayjs | null
      page?: number
      limit?: number
    }
  ) {
    const params: any = {}
    if (opts?.subject && opts.subject !== 'all') params.subject = opts.subject
    if (opts?.start) params.start_date = opts.start.format('YYYY-MM-DD')
    if (opts?.end) params.end_date = opts.end.format('YYYY-MM-DD')
    if (opts?.page) params.page = opts.page
    if (opts?.limit) params.limit = opts.limit

    const res = await api.get(`/leaderboard/${id}`, { params })
    // 兼容 records / items / 直接数组
    const items = pickArray<LeaderboardEntry>(res, [])
    // 如有分页信息可从 res.data.pagination 里取；这里先前端分页
    return { items, total: items.length }
  },

  async getStats() {
    // 如果你的后端有接口，直接 GET 即可；此处用模拟兼容
    // const res = await api.get('/leaderboard/stats')
    // return pickObject<LeaderboardStats>(res, { total_participants: 0, avg_score: 0, top_score: 0 })!
    return {
      total_participants: 156,
      avg_score: 78.5,
      top_score: 98.5,
      my_rank: 23,
    } as LeaderboardStats
  },

  async getSubjects() {
    // 同上，后端可换成真实接口
    return ['数学', '语文', '英语', '物理', '化学', '生物']
  },
}
export default leaderboardApi
