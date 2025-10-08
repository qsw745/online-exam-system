// apps/backend/src/modules/analytics/services/analytics.service.ts
import { AnalyticsRepository, type DateParams } from '../repositories/analytics.repository.js'

let RC: any = null
;(async () => {
  try {
    const mod: any = await import('@/common/redis/cache')
    RC = mod?.default ?? mod
  } catch {}
})()

const A_TTL = 180
const kA = (p: any) => `analytics:data:${JSON.stringify(p)}`
const kO = (period: string) => `analytics:overview:${period}`

async function cget<T = any>(k: string) {
  try {
    const v = await RC?.get?.(k)
    return v ? JSON.parse(v) : null
  } catch {
    return null
  }
}
async function cset(k: string, v: any, ttl = A_TTL) {
  try {
    await RC?.set?.(k, JSON.stringify(v), ttl)
  } catch {}
}

export class AnalyticsService {
  private repo = new AnalyticsRepository()

  async getAnalyticsData(params: { start_date?: string; end_date?: string; subject?: string }) {
    const ck = kA(params)
    const hit = await cget(ck)
    if (hit) return hit
    const p: DateParams = {
      start_date: params.start_date || null,
      end_date: params.end_date || null,
      subject: params.subject || null,
    }
    const [overview, subjects, students] = await Promise.all([
      this.repo.getOverview(p),
      this.repo.getSubjectsStats(p),
      this.repo.getStudents(p),
    ])
    const data = { overview, subjects, students }
    await cset(ck, data, 180)
    return data
  }

  async getSubjects(): Promise<string[]> {
    return this.repo.getSubjects()
  }

  async getOverview(period: string) {
    const ck = kO(period)
    const hit = await cget(ck)
    if (hit) return hit
    const { start_date, end_date } = this.getRangeByPeriod(period)
    const data = await this.repo.getOverview({ start_date, end_date })
    await cset(ck, data, 120)
    return data
  }

  async getKnowledgePoints() {
    return [
      { id: '1', name: '数据结构', questionCount: 24, correctRate: 0.85 },
      { id: '2', name: '算法', questionCount: 18, correctRate: 0.72 },
      { id: '3', name: '网络原理', questionCount: 15, correctRate: 0.65 },
      { id: '4', name: '操作系统', questionCount: 20, correctRate: 0.78 },
      { id: '5', name: '数据库', questionCount: 22, correctRate: 0.8 },
    ]
  }

  async getDifficultyDistribution() {
    return [
      { difficulty: '简单', count: 35, correctRate: 0.92 },
      { difficulty: '中等', count: 42, correctRate: 0.75 },
      { difficulty: '困难', count: 23, correctRate: 0.58 },
    ]
  }

  async getUserActivity(period: string) {
    const { start_date } = this.getRangeByPeriod(period)
    const days = period === '30d' ? 30 : period === '90d' ? 90 : 7
    const dates: string[] = []
    const cur = new Date(start_date)
    for (let i = 0; i < days; i++) {
      dates.push(new Date(cur.getTime() - cur.getTimezoneOffset() * 60000).toISOString().slice(0, 10))
      cur.setDate(cur.getDate() + 1)
    }
    return dates.map(d => {
      const day = new Date(d).getDay()
      const count = day === 0 || day === 6 ? Math.floor(Math.random() * 20) + 10 : Math.floor(Math.random() * 30) + 25
      return { date: d, count }
    })
  }

  async getGradeStats(params: { start_date?: string; end_date?: string }) {
    const p: DateParams = {
      start_date: params.start_date || null,
      end_date: params.end_date || null,
      subject: null,
    }
    return this.repo.getGradeStats(p)
  }

  private getRangeByPeriod(period: string): { start_date: string; end_date: string } {
    const end = new Date()
    const start = new Date()
    if (period === '30d') start.setDate(end.getDate() - 30)
    else if (period === '90d') start.setDate(end.getDate() - 90)
    else start.setDate(end.getDate() - 7)
    const fmt = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
    return { start_date: fmt(start), end_date: fmt(end) }
  }
}
