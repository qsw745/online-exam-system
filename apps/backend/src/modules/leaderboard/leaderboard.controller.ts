import { Response } from 'express'
import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool } from '@config/database.js'
import { AuthRequest } from 'types/auth.js'
import { ApiResponse } from 'types/response.js'

interface ILeaderboard extends RowDataPacket {
  id: number
  name: string
  description: string
  type: 'score' | 'time' | 'accuracy' | 'progress' | 'custom'
  category: 'global' | 'subject' | 'exam' | 'monthly' | 'weekly' | 'daily'
  subject_id?: number
  exam_id?: number
  calculation_method: any
  is_active: boolean
  start_date?: Date
  end_date?: Date
  created_by: number
  created_at: Date
  updated_at: Date
}

interface ILeaderboardRecord extends RowDataPacket {
  id: number
  leaderboard_id: number
  user_id: number
  score: number
  rank_position: number
  additional_data: any
  record_date: Date
  username?: string
  email?: string
  avatar?: string
}

interface ICompetition extends RowDataPacket {
  id: number
  title: string
  description: string
  type: 'individual' | 'team'
  status: 'draft' | 'registration' | 'ongoing' | 'finished' | 'cancelled'
  registration_start?: Date
  registration_end?: Date
  competition_start?: Date
  competition_end?: Date
  max_participants?: number
  rules: any
  prizes: any
  created_by: number
  participant_count?: number
}

export class LeaderboardController {
  // 获取排行榜列表
  static async getLeaderboards(req: AuthRequest, res: Response<ApiResponse<{ leaderboards: ILeaderboard[] }>>) {
    try {
      const { category, type, active } = req.query

      let query = 'SELECT * FROM leaderboards WHERE 1=1'
      const params: any[] = []

      if (category && category !== 'all') {
        query += ' AND category = ?'
        params.push(category)
      }

      if (type && type !== 'all') {
        query += ' AND type = ?'
        params.push(type)
      }

      if (active !== undefined) {
        query += ' AND is_active = ?'
        params.push(active === 'true')
      }

      query += ' ORDER BY created_at DESC'

      const [leaderboards] = await pool.query<ILeaderboard[]>(query, params)

      return res.json({
        success: true,
        data: { leaderboards },
      })
    } catch (error) {
      console.error('获取排行榜列表错误:', error)
      return res.status(500).json({
        success: false,
        error: '获取排行榜列表失败',
      })
    }
  }

  // 获取排行榜详情和排名数据
  static async getLeaderboardData(
    req: AuthRequest,
    res: Response<ApiResponse<{ leaderboard: ILeaderboard; records: ILeaderboardRecord[] }>>
  ) {
    try {
      const leaderboardId = parseInt(req.params.id)
      const { page = 1, limit = 50 } = req.query

      if (isNaN(leaderboardId)) {
        return res.status(400).json({
          success: false,
          error: '无效的排行榜ID',
        })
      }

      // 获取排行榜信息
      const [leaderboards] = await pool.query<ILeaderboard[]>('SELECT * FROM leaderboards WHERE id = ?', [
        leaderboardId,
      ])

      if (leaderboards.length === 0) {
        return res.status(404).json({
          success: false,
          error: '排行榜不存在',
        })
      }

      const leaderboard = leaderboards[0]

      // 获取排行榜记录
      const offset = (Number(page) - 1) * Number(limit)
      const [records] = await pool.query<ILeaderboardRecord[]>(
        `SELECT lr.*, u.username, u.email 
         FROM leaderboard_records lr
         JOIN users u ON lr.user_id = u.id
         WHERE lr.leaderboard_id = ?
         ORDER BY lr.rank_position ASC
         LIMIT ? OFFSET ?`,
        [leaderboardId, Number(limit), offset]
      )

      return res.json({
        success: true,
        data: { leaderboard, records },
      })
    } catch (error) {
      console.error('获取排行榜数据错误:', error)
      return res.status(500).json({
        success: false,
        error: '获取排行榜数据失败',
      })
    }
  }

  // 获取用户在排行榜中的排名
  static async getUserRank(
    req: AuthRequest,
    res: Response<ApiResponse<{ rank: ILeaderboardRecord | null; total: number }>>
  ) {
    try {
      const userId = req.user?.id
      const leaderboardId = parseInt(req.params.id)

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: '未授权访问',
        })
      }

      if (isNaN(leaderboardId)) {
        return res.status(400).json({
          success: false,
          error: '无效的排行榜ID',
        })
      }

      // 获取用户排名
      const [userRanks] = await pool.query<ILeaderboardRecord[]>(
        `SELECT lr.*, u.username, u.email 
         FROM leaderboard_records lr
         JOIN users u ON lr.user_id = u.id
         WHERE lr.leaderboard_id = ? AND lr.user_id = ?
         ORDER BY lr.record_date DESC
         LIMIT 1`,
        [leaderboardId, userId]
      )

      // 获取总参与人数
      const [totalResult] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(DISTINCT user_id) as total FROM leaderboard_records WHERE leaderboard_id = ?',
        [leaderboardId]
      )

      const total = totalResult[0]?.total || 0
      const rank = userRanks.length > 0 ? userRanks[0] : null

      return res.json({
        success: true,
        data: { rank, total },
      })
    } catch (error) {
      console.error('获取用户排名错误:', error)
      return res.status(500).json({
        success: false,
        error: '获取用户排名失败',
      })
    }
  }

  // 更新排行榜数据（管理员功能）
  static async updateLeaderboardData(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      const userRole = req.user?.role

      if (!userId || userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          error: '权限不足',
        })
      }

      const leaderboardId = parseInt(req.params.id)

      if (isNaN(leaderboardId)) {
        return res.status(400).json({
          success: false,
          error: '无效的排行榜ID',
        })
      }

      // 获取排行榜配置
      const [leaderboards] = await pool.query<ILeaderboard[]>('SELECT * FROM leaderboards WHERE id = ?', [
        leaderboardId,
      ])

      if (leaderboards.length === 0) {
        return res.status(404).json({
          success: false,
          error: '排行榜不存在',
        })
      }

      const leaderboard = leaderboards[0]

      // 根据排行榜类型重新计算排名
      await LeaderboardController.calculateLeaderboardRanks(leaderboard)

      return res.json({
        success: true,
        data: null,
      })
    } catch (error) {
      console.error('更新排行榜数据错误:', error)
      return res.status(500).json({
        success: false,
        error: '更新排行榜数据失败',
      })
    }
  }

  // 获取竞赛列表
  static async getCompetitions(req: AuthRequest, res: Response<ApiResponse<{ competitions: ICompetition[] }>>) {
    try {
      const { status, type } = req.query

      let query = `
        SELECT c.*, 
               COUNT(cp.id) as participant_count
        FROM competitions c
        LEFT JOIN competition_participants cp ON c.id = cp.competition_id
        WHERE 1=1
      `
      const params: any[] = []

      if (status && status !== 'all') {
        query += ' AND c.status = ?'
        params.push(status)
      }

      if (type && type !== 'all') {
        query += ' AND c.type = ?'
        params.push(type)
      }

      query += ' GROUP BY c.id ORDER BY c.created_at DESC'

      const [competitions] = await pool.query<ICompetition[]>(query, params)

      return res.json({
        success: true,
        data: { competitions },
      })
    } catch (error) {
      console.error('获取竞赛列表错误:', error)
      return res.status(500).json({
        success: false,
        error: '获取竞赛列表失败',
      })
    }
  }

  // 参加竞赛
  static async joinCompetition(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      const competitionId = parseInt(req.params.id)
      const { team_name } = req.body

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: '未授权访问',
        })
      }

      if (isNaN(competitionId)) {
        return res.status(400).json({
          success: false,
          error: '无效的竞赛ID',
        })
      }

      // 检查竞赛是否存在且可报名
      const [competitions] = await pool.query<ICompetition[]>(
        'SELECT * FROM competitions WHERE id = ? AND status = "registration"',
        [competitionId]
      )

      if (competitions.length === 0) {
        return res.status(404).json({
          success: false,
          error: '竞赛不存在或不在报名期间',
        })
      }

      const competition = competitions[0]

      // 检查是否已经参加
      const [existing] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM competition_participants WHERE competition_id = ? AND user_id = ?',
        [competitionId, userId]
      )

      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          error: '您已经参加了这个竞赛',
        })
      }

      // 检查参与人数限制
      if (competition.max_participants) {
        const [countResult] = await pool.query<RowDataPacket[]>(
          'SELECT COUNT(*) as count FROM competition_participants WHERE competition_id = ?',
          [competitionId]
        )

        if (countResult[0].count >= competition.max_participants) {
          return res.status(400).json({
            success: false,
            error: '竞赛参与人数已满',
          })
        }
      }

      // 添加参与记录
      await pool.query<ResultSetHeader>(
        'INSERT INTO competition_participants (competition_id, user_id, team_name) VALUES (?, ?, ?)',
        [competitionId, userId, team_name || null]
      )

      return res.json({
        success: true,
        data: null,
      })
    } catch (error) {
      console.error('参加竞赛错误:', error)
      return res.status(500).json({
        success: false,
        error: '参加竞赛失败',
      })
    }
  }

  // 获取用户成就
  static async getUserAchievements(req: AuthRequest, res: Response<ApiResponse<{ achievements: any[] }>>) {
    try {
      const userId = req.user?.id

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: '未授权访问',
        })
      }

      const [achievements] = await pool.query<RowDataPacket[]>(
        `SELECT la.*, l.name as leaderboard_name, c.title as competition_title
         FROM leaderboard_achievements la
         LEFT JOIN leaderboards l ON la.leaderboard_id = l.id
         LEFT JOIN competitions c ON la.competition_id = c.id
         WHERE la.user_id = ?
         ORDER BY la.achieved_at DESC`,
        [userId]
      )

      return res.json({
        success: true,
        data: { achievements },
      })
    } catch (error) {
      console.error('获取用户成就错误:', error)
      return res.status(500).json({
        success: false,
        error: '获取用户成就失败',
      })
    }
  }

  // 计算排行榜排名的私有方法
  private static async calculateLeaderboardRanks(leaderboard: ILeaderboard) {
    const connection = await pool.getConnection()

    try {
      await connection.beginTransaction()

      // 根据排行榜类型计算分数和排名
      switch (leaderboard.type) {
        case 'score':
          await this.calculateScoreRanks(connection, leaderboard)
          break
        case 'time':
          await this.calculateTimeRanks(connection, leaderboard)
          break
        case 'accuracy':
          await this.calculateAccuracyRanks(connection, leaderboard)
          break
        case 'progress':
          await this.calculateProgressRanks(connection, leaderboard)
          break
      }

      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  // 计算分数排名
  private static async calculateScoreRanks(connection: any, leaderboard: ILeaderboard) {
    // 根据分类计算不同的分数
    let scoreQuery = ''
    const today = new Date().toISOString().split('T')[0]

    switch (leaderboard.category) {
      case 'global':
        scoreQuery = `
          SELECT user_id, SUM(score) as total_score
          FROM exam_results 
          WHERE status = 'submitted'
          GROUP BY user_id
        `
        break
      case 'monthly':
        scoreQuery = `
          SELECT user_id, SUM(score) as total_score
          FROM exam_results 
          WHERE status = 'submitted' 
            AND DATE_FORMAT(submit_time, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')
          GROUP BY user_id
        `
        break
      case 'weekly':
        scoreQuery = `
          SELECT user_id, SUM(score) as total_score
          FROM exam_results 
          WHERE status = 'submitted' 
            AND YEARWEEK(submit_time) = YEARWEEK(NOW())
          GROUP BY user_id
        `
        break
      case 'daily':
        scoreQuery = `
          SELECT user_id, SUM(score) as total_score
          FROM exam_results 
          WHERE status = 'submitted' 
            AND DATE(submit_time) = CURDATE()
          GROUP BY user_id
        `
        break
    }

    if (scoreQuery) {
      const [scores] = await connection.query(scoreQuery)

      // 删除旧记录
      await connection.query('DELETE FROM leaderboard_records WHERE leaderboard_id = ? AND record_date = ?', [
        leaderboard.id,
        today,
      ])

      // 插入新记录并计算排名
      for (let i = 0; i < scores.length; i++) {
        const score = scores[i]
        await connection.query(
          'INSERT INTO leaderboard_records (leaderboard_id, user_id, score, rank_position, record_date) VALUES (?, ?, ?, ?, ?)',
          [leaderboard.id, score.user_id, score.total_score, i + 1, today]
        )
      }
    }
  }

  // 计算时间排名
  private static async calculateTimeRanks(connection: any, leaderboard: ILeaderboard) {
    const today = new Date().toISOString().split('T')[0]

    let timeQuery = ''
    switch (leaderboard.category) {
      case 'weekly':
        timeQuery = `
          SELECT user_id, SUM(time_spent) as total_time
          FROM learning_progress 
          WHERE YEARWEEK(created_at) = YEARWEEK(NOW())
          GROUP BY user_id
          ORDER BY total_time DESC
        `
        break
      case 'monthly':
        timeQuery = `
          SELECT user_id, SUM(time_spent) as total_time
          FROM learning_progress 
          WHERE DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')
          GROUP BY user_id
          ORDER BY total_time DESC
        `
        break
    }

    if (timeQuery) {
      const [times] = await connection.query(timeQuery)

      // 删除旧记录
      await connection.query('DELETE FROM leaderboard_records WHERE leaderboard_id = ? AND record_date = ?', [
        leaderboard.id,
        today,
      ])

      // 插入新记录
      for (let i = 0; i < times.length; i++) {
        const time = times[i]
        await connection.query(
          'INSERT INTO leaderboard_records (leaderboard_id, user_id, score, rank_position, record_date, additional_data) VALUES (?, ?, ?, ?, ?, ?)',
          [leaderboard.id, time.user_id, time.total_time, i + 1, today, JSON.stringify({ study_time: time.total_time })]
        )
      }
    }
  }

  // 计算正确率排名
  private static async calculateAccuracyRanks(connection: any, leaderboard: ILeaderboard) {
    const today = new Date().toISOString().split('T')[0]
    const minQuestions = leaderboard.calculation_method?.min_questions || 50

    const accuracyQuery = `
      SELECT 
        user_id,
        SUM(total_questions) as total_questions,
        SUM(correct_answers) as total_correct,
        (SUM(correct_answers) / SUM(total_questions) * 100) as accuracy_rate
      FROM learning_progress 
      WHERE total_questions > 0
      GROUP BY user_id
      HAVING total_questions >= ?
      ORDER BY accuracy_rate DESC
    `

    const [accuracies] = await connection.query(accuracyQuery, [minQuestions])

    // 删除旧记录
    await connection.query('DELETE FROM leaderboard_records WHERE leaderboard_id = ? AND record_date = ?', [
      leaderboard.id,
      today,
    ])

    // 插入新记录
    for (let i = 0; i < accuracies.length; i++) {
      const accuracy = accuracies[i]
      await connection.query(
        'INSERT INTO leaderboard_records (leaderboard_id, user_id, score, rank_position, record_date, additional_data) VALUES (?, ?, ?, ?, ?, ?)',
        [
          leaderboard.id,
          accuracy.user_id,
          accuracy.accuracy_rate,
          i + 1,
          today,
          JSON.stringify({
            total_questions: accuracy.total_questions,
            total_correct: accuracy.total_correct,
            accuracy_rate: accuracy.accuracy_rate,
          }),
        ]
      )
    }
  }

  // 计算学习进度排名
  private static async calculateProgressRanks(connection: any, leaderboard: ILeaderboard) {
    const today = new Date().toISOString().split('T')[0]

    const progressQuery = `
      SELECT 
        user_id,
        SUM(time_spent) as total_study_time,
        SUM(total_questions) as total_questions,
        SUM(correct_answers) as total_correct,
        COUNT(*) as study_sessions,
        (SUM(time_spent) * 0.3 + SUM(total_questions) * 0.4 + SUM(correct_answers) * 0.3) as progress_score
      FROM learning_progress 
      GROUP BY user_id
      ORDER BY progress_score DESC
    `

    const [progresses] = await connection.query(progressQuery)

    // 删除旧记录
    await connection.query('DELETE FROM leaderboard_records WHERE leaderboard_id = ? AND record_date = ?', [
      leaderboard.id,
      today,
    ])

    // 插入新记录
    for (let i = 0; i < progresses.length; i++) {
      const progress = progresses[i]
      await connection.query(
        'INSERT INTO leaderboard_records (leaderboard_id, user_id, score, rank_position, record_date, additional_data) VALUES (?, ?, ?, ?, ?, ?)',
        [
          leaderboard.id,
          progress.user_id,
          progress.progress_score,
          i + 1,
          today,
          JSON.stringify({
            total_study_time: progress.total_study_time,
            total_questions: progress.total_questions,
            total_correct: progress.total_correct,
            study_sessions: progress.study_sessions,
          }),
        ]
      )
    }
  }
}
