import { Response } from 'express'
import { RowDataPacket } from 'mysql2'
import { pool } from '@config/database.js'
import { AuthRequest } from 'types/auth.js'
import { ApiResponse } from 'types/response.js'

interface IOverview extends RowDataPacket {
  totalUsers: number
  activeUsers: number
  totalSubmissions: number
  averageScore: number
}

interface IKnowledgePoint extends RowDataPacket {
  id: string
  name: string
  correctRate: number
  questionCount: number
}

interface IDifficultyData extends RowDataPacket {
  difficulty: string
  count: number
  correctRate: number
}

interface IActivityData extends RowDataPacket {
  date: string
  count: number
}

export class AnalyticsController {
  // 获取综合分析数据（前端AnalyticsPage调用）
  static async getAnalytics(req: AuthRequest, res: Response) {
    try {
      const { start_date, end_date, subject } = req.query

      // 模拟综合分析数据
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

      res.json({
        success: true,
        message: '获取分析数据成功',
        data: analyticsData,
      })
    } catch (error) {
      console.error('获取分析数据失败:', error)
      res.status(500).json({
        success: false,
        message: '获取分析数据失败',
        data: null,
      })
    }
  }

  // 获取科目列表
  static async getSubjects(req: AuthRequest, res: Response) {
    try {
      // 模拟科目数据
      const subjects = ['数学', '语文', '英语', '物理', '化学', '生物', '历史', '地理']

      res.json({
        success: true,
        message: '获取科目列表成功',
        data: subjects,
      })
    } catch (error) {
      console.error('获取科目列表失败:', error)
      res.status(500).json({
        success: false,
        message: '获取科目列表失败',
        data: null,
      })
    }
  }

  // 获取概览数据
  static async getOverview(req: AuthRequest, res: Response) {
    try {
      const period = (req.query.period as string) || '7d'

      // 由于数据库表尚未创建，使用模拟数据
      // 在实际环境中，应该查询数据库获取真实数据

      // 模拟数据
      let totalUsers = 0
      let activeUsers = 0
      let totalSubmissions = 0
      let averageScore = 0

      try {
        // 尝试获取用户总数
        const [userCountResult] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as total FROM users')
        totalUsers = userCountResult[0].total || 0
      } catch (err) {
        console.log('获取用户总数失败，使用模拟数据')
        totalUsers = 120
      }

      // 模拟数据 - 根据不同时间段返回不同的活跃用户数
      switch (period) {
        case '7d':
          activeUsers = 85
          totalSubmissions = 150
          averageScore = 78.5
          break
        case '30d':
          activeUsers = 95
          totalSubmissions = 450
          averageScore = 76.2
          break
        case '90d':
          activeUsers = 110
          totalSubmissions = 950
          averageScore = 75.8
          break
        case 'all':
          activeUsers = 120
          totalSubmissions = 1200
          averageScore = 74.5
          break
        default:
          activeUsers = 85
          totalSubmissions = 150
          averageScore = 78.5
      }

      const overview = {
        totalUsers,
        activeUsers,
        totalSubmissions,
        averageScore,
      }

      const response: ApiResponse<typeof overview> = {
        success: true,
        data: overview,
      }

      return res.json(response)
    } catch (error) {
      console.error('获取概览数据错误:', error)
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : '获取概览数据失败',
      }
      return res.status(500).json(response)
    }
  }

  // 获取知识点掌握情况
  static async getKnowledgePoints(req: AuthRequest, res: Response) {
    try {
      // 由于数据库表尚未创建，使用模拟数据
      // 在实际环境中，应该查询数据库获取真实数据

      // 模拟数据
      const knowledgePoints = [
        { id: '1', name: '数据结构', questionCount: 24, correctRate: 0.85 },
        { id: '2', name: '算法', questionCount: 18, correctRate: 0.72 },
        { id: '3', name: '网络原理', questionCount: 15, correctRate: 0.65 },
        { id: '4', name: '操作系统', questionCount: 20, correctRate: 0.78 },
        { id: '5', name: '数据库', questionCount: 22, correctRate: 0.8 },
      ]

      const response: ApiResponse<typeof knowledgePoints> = {
        success: true,
        data: knowledgePoints,
      }

      return res.json(response)
    } catch (error) {
      console.error('获取知识点数据错误:', error)
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : '获取知识点数据失败',
      }
      return res.status(500).json(response)
    }
  }

  // 获取难度分布
  static async getDifficultyDistribution(req: AuthRequest, res: Response) {
    try {
      // 由于数据库表尚未创建，使用模拟数据
      // 在实际环境中，应该查询数据库获取真实数据

      // 模拟数据
      const difficultyDistribution = [
        { difficulty: '简单', count: 35, correctRate: 0.92 },
        { difficulty: '中等', count: 42, correctRate: 0.75 },
        { difficulty: '困难', count: 23, correctRate: 0.58 },
      ]

      const response: ApiResponse<typeof difficultyDistribution> = {
        success: true,
        data: difficultyDistribution,
      }

      return res.json(response)
    } catch (error) {
      console.error('获取难度分布数据错误:', error)
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : '获取难度分布数据失败',
      }
      return res.status(500).json(response)
    }
  }

  // 获取用户活跃度
  static async getUserActivity(req: AuthRequest, res: Response) {
    try {
      const period = (req.query.period as string) || '7d'

      // 由于数据库表尚未创建，使用模拟数据
      // 在实际环境中，应该查询数据库获取真实数据

      // 计算日期范围
      const dateRange = getDateRangeFromPeriod(period)
      const days = getNumberOfDaysInPeriod(period)

      // 生成日期序列
      const dateSequence = generateDateSequence(dateRange.startDate, days)

      // 模拟数据
      const activityData = []

      // 根据不同时间段生成不同的模拟数据
      for (let i = 0; i < dateSequence.length; i++) {
        const date = dateSequence[i]
        let count

        // 工作日活跃度高，周末低
        const dayOfWeek = new Date(date).getDay()
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          // 周末
          count = Math.floor(Math.random() * 20) + 10
        } else {
          // 工作日
          count = Math.floor(Math.random() * 30) + 25
        }

        activityData.push({
          date,
          count,
        })
      }

      const response: ApiResponse<typeof activityData> = {
        success: true,
        data: activityData,
      }

      return res.json(response)
    } catch (error) {
      console.error('获取用户活跃度数据错误:', error)
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : '获取用户活跃度数据失败',
      }
      return res.status(500).json(response)
    }
  }

  // 获取成绩统计数据
  static async getGradeStats(req: AuthRequest, res: Response) {
    try {
      // 获取参与学生总数
      const [studentCountResult] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(DISTINCT user_id) as totalStudents 
         FROM exam_results WHERE status = 'submitted'`
      )
      const totalStudents = studentCountResult[0]?.totalStudents || 0

      // 获取考试总数
      const [examCountResult] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as totalExams 
         FROM exam_results WHERE status = 'submitted'`
      )
      const totalExams = examCountResult[0]?.totalExams || 0

      // 获取平均分
      const [avgScoreResult] = await pool.query<RowDataPacket[]>(
        `SELECT AVG(score) as avgScore 
          FROM exam_results WHERE status = 'submitted'`
      )
      const averageScore = avgScoreResult[0]?.averageScore || 0

      // 获取及格率（假设60分及格）
      const [passRateResult] = await pool.query<RowDataPacket[]>(
        `SELECT 
           COUNT(CASE WHEN (er.score / p.total_score * 100) >= 60 THEN 1 END) as passCount,
           COUNT(*) as totalCount
         FROM exam_results er
         JOIN exams e ON er.exam_id = e.id
         JOIN papers p ON e.paper_id = p.id
         WHERE er.status = 'submitted'`
      )
      const passCount = passRateResult[0]?.passCount || 0
      const totalCount = passRateResult[0]?.totalCount || 0
      const passRate = totalCount > 0 ? (passCount / totalCount) * 100 : 0

      const response: ApiResponse<any> = {
        success: true,
        data: {
          totalStudents,
          totalExams,
          averageScore: Number(averageScore.toFixed(1)),
          passRate: Number(passRate.toFixed(1)),
        },
      }

      res.json(response)
    } catch (error: any) {
      console.error('获取成绩统计数据错误:', error)
      const errorResponse: ApiResponse<null> = {
        success: false,
        error: '获取成绩统计数据失败',
      }
      res.status(500).json(errorResponse)
    }
  }
}

// 辅助函数：根据时间段获取日期范围
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
      startDate = new Date(2000, 0, 1) // 使用一个很早的日期
      break
    default:
      startDate.setDate(endDate.getDate() - 7) // 默认7天
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  }
}

// 辅助函数：获取时间段包含的天数
function getNumberOfDaysInPeriod(period: string): number {
  switch (period) {
    case '7d':
      return 7
    case '30d':
      return 30
    case '90d':
      return 90
    case 'all':
      return 365 // 对于"全部"，我们限制为一年的数据点
    default:
      return 7
  }
}

// 辅助函数：生成日期序列
function generateDateSequence(startDate: string, days: number): string[] {
  const result: string[] = []
  const currentDate = new Date(startDate)

  for (let i = 0; i < days; i++) {
    result.push(currentDate.toISOString().split('T')[0])
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return result
}
