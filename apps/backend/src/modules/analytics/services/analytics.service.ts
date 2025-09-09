import { pool } from '@config/database.js'
import type { RowDataPacket } from 'mysql2'
import type { IOverview, IKnowledgePoint, IDifficultyData, IActivityData } from '../domain/analytics.model.js'

export class AnalyticsService {
  async getAnalyticsData(params: { start_date?: string; end_date?: string; subject?: string }) {
    // 这里仍返回示例数据；将来可替换为真实统计 SQL
    const analyticsData = {
      overview: {
        total_students: 120,
        total_questions: 850,
        total_exams: 45,
        avg_score: 78.5,
        completion_rate: 85.2,
        active_students: 95,
      },
      trends: [
        { date: '2024-01-01', students_count: 80, exams_count: 12, avg_score: 75.2 },
        { date: '2024-01-02', students_count: 85, exams_count: 15, avg_score: 76.8 },
        { date: '2024-01-03', students_count: 90, exams_count: 18, avg_score: 78.1 },
        { date: '2024-01-04', students_count: 95, exams_count: 20, avg_score: 79.3 },
        { date: '2024-01-05', students_count: 88, exams_count: 16, avg_score: 77.9 },
      ],
      subjects: [
        { subject: '数学', questions_count: 200, avg_score: 82.1, completion_rate: 88.5 },
        { subject: '语文', questions_count: 180, avg_score: 79.3, completion_rate: 85.2 },
        { subject: '英语', questions_count: 220, avg_score: 75.8, completion_rate: 82.1 },
        { subject: '物理', questions_count: 150, avg_score: 73.2, completion_rate: 79.8 },
        { subject: '化学', questions_count: 100, avg_score: 76.5, completion_rate: 81.3 },
      ],
      students: [
        {
          user_id: 1,
          username: '张三',
          total_score: 450,
          exams_completed: 8,
          avg_score: 85.2,
          study_time: 120,
          last_active: '2024-01-05',
        },
        {
          user_id: 2,
          username: '李四',
          total_score: 420,
          exams_completed: 7,
          avg_score: 82.1,
          study_time: 105,
          last_active: '2024-01-04',
        },
        {
          user_id: 3,
          username: '王五',
          total_score: 380,
          exams_completed: 6,
          avg_score: 78.9,
          study_time: 95,
          last_active: '2024-01-03',
        },
      ],
    }
    return analyticsData
  }

  async getSubjects(): Promise<string[]> {
    return ['数学', '语文', '英语', '物理', '化学', '生物', '历史', '地理']
  }

  async getOverview(period: string): Promise<IOverview> {
    let totalUsers = 0
    try {
      const [userCountResult] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as total FROM users')
      totalUsers = (userCountResult[0] as any)?.total || 0
    } catch {
      totalUsers = 120 // fallback
    }

    const preset = {
      '7d': { activeUsers: 85, totalSubmissions: 150, averageScore: 78.5 },
      '30d': { activeUsers: 95, totalSubmissions: 450, averageScore: 76.2 },
      '90d': { activeUsers: 110, totalSubmissions: 950, averageScore: 75.8 },
      all: { activeUsers: 120, totalSubmissions: 1200, averageScore: 74.5 },
    } as const
    const pick = preset[period as keyof typeof preset] ?? preset['7d']

    return {
      totalUsers,
      activeUsers: pick.activeUsers,
      totalSubmissions: pick.totalSubmissions,
      averageScore: pick.averageScore,
    } as IOverview
  }

  async getKnowledgePoints(): Promise<IKnowledgePoint[]> {
    return [
      { id: '1', name: '数据结构', questionCount: 24, correctRate: 0.85 } as any,
      { id: '2', name: '算法', questionCount: 18, correctRate: 0.72 } as any,
      { id: '3', name: '网络原理', questionCount: 15, correctRate: 0.65 } as any,
      { id: '4', name: '操作系统', questionCount: 20, correctRate: 0.78 } as any,
      { id: '5', name: '数据库', questionCount: 22, correctRate: 0.8 } as any,
    ]
  }

  async getDifficultyDistribution(): Promise<IDifficultyData[]> {
    return [
      { difficulty: '简单', count: 35, correctRate: 0.92 } as any,
      { difficulty: '中等', count: 42, correctRate: 0.75 } as any,
      { difficulty: '困难', count: 23, correctRate: 0.58 } as any,
    ]
  }

  async getUserActivity(period: string): Promise<IActivityData[]> {
    const { startDate } = getDateRangeFromPeriod(period)
    const days = getNumberOfDaysInPeriod(period)
    const dates = generateDateSequence(startDate, days)

    return dates.map(d => {
      const day = new Date(d).getDay()
      const count = day === 0 || day === 6 ? Math.floor(Math.random() * 20) + 10 : Math.floor(Math.random() * 30) + 25
      return { date: d, count } as IActivityData
    })
  }

  async getGradeStats() {
    const [studentCountResult] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT user_id) as totalStudents FROM exam_results WHERE status = 'submitted'`
    )
    const totalStudents = (studentCountResult[0] as any)?.totalStudents || 0

    const [examCountResult] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as totalExams FROM exam_results WHERE status = 'submitted'`
    )
    const totalExams = (examCountResult[0] as any)?.totalExams || 0

    const [avgScoreResult] = await pool.query<RowDataPacket[]>(
      `SELECT AVG(score) as avgScore FROM exam_results WHERE status = 'submitted'`
    )
    const avgScore = Number(((avgScoreResult[0] as any)?.avgScore || 0).toFixed(1))

    const [passRateResult] = await pool.query<RowDataPacket[]>(
      `SELECT 
         COUNT(CASE WHEN (er.score / p.total_score * 100) >= 60 THEN 1 END) as passCount,
         COUNT(*) as totalCount
       FROM exam_results er
       JOIN exams e ON er.exam_id = e.id
       JOIN papers p ON e.paper_id = p.id
       WHERE er.status = 'submitted'`
    )
    const passCount = (passRateResult[0] as any)?.passCount || 0
    const totalCount = (passRateResult[0] as any)?.totalCount || 0
    const passRate = Number((totalCount > 0 ? (passCount / totalCount) * 100 : 0).toFixed(1))

    return { totalStudents, totalExams, averageScore: avgScore, passRate }
  }
}

/* ===== 内部辅助（保持与原逻辑一致） ===== */
function getDateRangeFromPeriod(period: string): { startDate: string; endDate: string } {
  const endDate = new Date()
  let startDate = new Date()
  switch (period) {
    case '7d':
      startDate.setDate(endDate.getDate() - 7)
      break
    case '30d':
      startDate.setDate(endDate.getDate() - 30)
      break
    case '90d':
      startDate.setDate(endDate.getDate() - 90)
      break
    case 'all':
      startDate = new Date(2000, 0, 1)
      break
    default:
      startDate.setDate(endDate.getDate() - 7)
  }
  return { startDate: toDateStr(startDate), endDate: toDateStr(endDate) }
}
function getNumberOfDaysInPeriod(period: string): number {
  switch (period) {
    case '7d':
      return 7
    case '30d':
      return 30
    case '90d':
      return 90
    case 'all':
      return 365
    default:
      return 7
  }
}
function generateDateSequence(startDate: string, days: number): string[] {
  const result: string[] = []
  const current = new Date(startDate)
  for (let i = 0; i < days; i++) {
    result.push(toDateStr(current))
    current.setDate(current.getDate() + 1)
  }
  return result
}
function toDateStr(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]
}
