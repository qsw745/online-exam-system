import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool } from '../config/database.js'

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
}

interface ILeaderboardRecord extends RowDataPacket {
  id: number
  leaderboard_id: number
  user_id: number
  score: number
  rank_position: number
  additional_data: any
  record_date: Date
}

export class LeaderboardService {
  async checkAndAwardRankingAchievements(userId: number): Promise<void> {
    // TODO: 检查是否达成成就并写入
    return
  }
  // 适配控制器当前的调用签名
  async updateLeaderboardRanking(boardId: number, userId: number, value: number): Promise<void> {
    // TODO: 在这里把 boardId 映射到你实际的排行榜表/字段并写入
    // 占位实现，保证编译通过：
    return
  }
  // 自动更新所有活跃排行榜
  static async updateAllActiveLeaderboards() {
    try {
      const [leaderboards] = await pool.query<ILeaderboard[]>('SELECT * FROM leaderboards WHERE is_active = TRUE')

      for (const leaderboard of leaderboards) {
        await this.updateLeaderboardRanks(leaderboard)
      }

      console.log(`已更新 ${leaderboards.length} 个排行榜`)
    } catch (error) {
      console.error('更新排行榜失败:', error)
      throw error
    }
  }

  // 更新特定排行榜排名
  static async updateLeaderboardRanks(leaderboard: ILeaderboard) {
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
      console.log(`排行榜 "${leaderboard.name}" 更新完成`)
    } catch (error) {
      await connection.rollback()
      console.error(`更新排行榜 "${leaderboard.name}" 失败:`, error)
      throw error
    } finally {
      connection.release()
    }
  }

  // 记录用户成就
  static async recordAchievement(
    userId: number,
    achievementType: string,
    achievementName: string,
    achievementDescription: string,
    leaderboardId?: number,
    competitionId?: number,
    metadata?: any
  ) {
    try {
      // 检查是否已经获得过相同成就
      const [existing] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM leaderboard_achievements 
         WHERE user_id = ? AND achievement_type = ? AND leaderboard_id = ? AND competition_id = ?`,
        [userId, achievementType, leaderboardId || null, competitionId || null]
      )

      if (existing.length === 0) {
        await pool.query<ResultSetHeader>(
          `INSERT INTO leaderboard_achievements 
           (user_id, achievement_type, achievement_name, achievement_description, leaderboard_id, competition_id, metadata) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            achievementType,
            achievementName,
            achievementDescription,
            leaderboardId || null,
            competitionId || null,
            JSON.stringify(metadata || {}),
          ]
        )

        console.log(`用户 ${userId} 获得成就: ${achievementName}`)
      }
    } catch (error) {
      console.error('记录成就失败:', error)
    }
  }

  // 检查并颁发排名成就
  static async checkRankingAchievements(leaderboardId: number) {
    try {
      const [records] = await pool.query<ILeaderboardRecord[]>(
        `SELECT lr.*, u.username 
         FROM leaderboard_records lr
         JOIN users u ON lr.user_id = u.id
         WHERE lr.leaderboard_id = ? AND lr.record_date = CURDATE()
         ORDER BY lr.rank_position ASC
         LIMIT 100`,
        [leaderboardId]
      )

      const [leaderboard] = await pool.query<ILeaderboard[]>('SELECT * FROM leaderboards WHERE id = ?', [leaderboardId])

      if (leaderboard.length === 0) return

      const leaderboardInfo = leaderboard[0]

      for (const record of records) {
        // 第一名成就
        if (record.rank_position === 1) {
          await this.recordAchievement(
            record.user_id,
            'top1',
            `${leaderboardInfo.name} - 第一名`,
            `在 ${leaderboardInfo.name} 中获得第一名`,
            leaderboardId,
            undefined,
            { rank: 1, score: record.score, date: record.record_date }
          )
        }

        // 前三名成就
        if (record.rank_position <= 3) {
          await this.recordAchievement(
            record.user_id,
            'top3',
            `${leaderboardInfo.name} - 前三名`,
            `在 ${leaderboardInfo.name} 中获得前三名`,
            leaderboardId,
            undefined,
            { rank: record.rank_position, score: record.score, date: record.record_date }
          )
        }

        // 前十名成就
        if (record.rank_position <= 10) {
          await this.recordAchievement(
            record.user_id,
            'top10',
            `${leaderboardInfo.name} - 前十名`,
            `在 ${leaderboardInfo.name} 中获得前十名`,
            leaderboardId,
            undefined,
            { rank: record.rank_position, score: record.score, date: record.record_date }
          )
        }

        // 前一百名成就
        if (record.rank_position <= 100) {
          await this.recordAchievement(
            record.user_id,
            'top100',
            `${leaderboardInfo.name} - 前一百名`,
            `在 ${leaderboardInfo.name} 中获得前一百名`,
            leaderboardId,
            undefined,
            { rank: record.rank_position, score: record.score, date: record.record_date }
          )
        }
      }
    } catch (error) {
      console.error('检查排名成就失败:', error)
    }
  }

  // 计算分数排名
  private static async calculateScoreRanks(connection: any, leaderboard: ILeaderboard) {
    const today = new Date().toISOString().split('T')[0]
    let scoreQuery = ''

    switch (leaderboard.category) {
      case 'global':
        scoreQuery = `
          SELECT user_id, SUM(score) as total_score
          FROM exam_results 
          WHERE status = 'submitted'
          GROUP BY user_id
          ORDER BY total_score DESC
        `
        break
      case 'monthly':
        scoreQuery = `
          SELECT user_id, SUM(score) as total_score
          FROM exam_results 
          WHERE status = 'submitted' 
            AND DATE_FORMAT(submit_time, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')
          GROUP BY user_id
          ORDER BY total_score DESC
        `
        break
      case 'weekly':
        scoreQuery = `
          SELECT user_id, SUM(score) as total_score
          FROM exam_results 
          WHERE status = 'submitted' 
            AND YEARWEEK(submit_time) = YEARWEEK(NOW())
          GROUP BY user_id
          ORDER BY total_score DESC
        `
        break
      case 'daily':
        scoreQuery = `
          SELECT user_id, SUM(score) as total_score
          FROM exam_results 
          WHERE status = 'submitted' 
            AND DATE(submit_time) = CURDATE()
          GROUP BY user_id
          ORDER BY total_score DESC
        `
        break
      case 'subject':
        if (leaderboard.subject_id) {
          scoreQuery = `
            SELECT er.user_id, SUM(er.score) as total_score
            FROM exam_results er
            JOIN exams e ON er.exam_id = e.id
            WHERE er.status = 'submitted' AND e.subject_id = ?
            GROUP BY er.user_id
            ORDER BY total_score DESC
          `
        }
        break
      case 'exam':
        if (leaderboard.exam_id) {
          scoreQuery = `
            SELECT user_id, score as total_score
            FROM exam_results 
            WHERE status = 'submitted' AND exam_id = ?
            ORDER BY total_score DESC
          `
        }
        break
    }

    if (scoreQuery) {
      const queryParams = []
      if (leaderboard.category === 'subject' && leaderboard.subject_id) {
        queryParams.push(leaderboard.subject_id)
      } else if (leaderboard.category === 'exam' && leaderboard.exam_id) {
        queryParams.push(leaderboard.exam_id)
      }

      const [scores] = await connection.query(scoreQuery, queryParams)

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
      case 'global':
        timeQuery = `
          SELECT user_id, SUM(study_time) as total_time
          FROM learning_progress 
          GROUP BY user_id
          ORDER BY total_time DESC
        `
        break
      case 'weekly':
        timeQuery = `
          SELECT user_id, SUM(study_time) as total_time
          FROM learning_progress 
          WHERE YEARWEEK(created_at) = YEARWEEK(NOW())
          GROUP BY user_id
          ORDER BY total_time DESC
        `
        break
      case 'monthly':
        timeQuery = `
          SELECT user_id, SUM(study_time) as total_time
          FROM learning_progress 
          WHERE DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')
          GROUP BY user_id
          ORDER BY total_time DESC
        `
        break
      case 'daily':
        timeQuery = `
          SELECT user_id, SUM(study_time) as total_time
          FROM learning_progress 
          WHERE DATE(created_at) = CURDATE()
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
        SUM(questions_answered) as total_questions,
        SUM(correct_answers) as total_correct,
        (SUM(correct_answers) / SUM(questions_answered) * 100) as accuracy_rate
      FROM learning_progress 
      WHERE questions_answered > 0
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
        SUM(study_time) as total_study_time,
        SUM(questions_answered) as total_questions,
        SUM(correct_answers) as total_correct,
        COUNT(*) as study_sessions,
        (SUM(study_time) * 0.3 + SUM(questions_answered) * 0.4 + SUM(correct_answers) * 0.3) as progress_score
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

  // 获取用户在所有排行榜中的最佳排名
  static async getUserBestRanks(userId: number) {
    try {
      const [ranks] = await pool.query<RowDataPacket[]>(
        `SELECT 
           l.name as leaderboard_name,
           l.type,
           l.category,
           MIN(lr.rank_position) as best_rank,
           MAX(lr.score) as best_score,
           lr.record_date
         FROM leaderboard_records lr
         JOIN leaderboards l ON lr.leaderboard_id = l.id
         WHERE lr.user_id = ?
         GROUP BY lr.leaderboard_id
         ORDER BY best_rank ASC`,
        [userId]
      )

      return ranks
    } catch (error) {
      console.error('获取用户最佳排名失败:', error)
      throw error
    }
  }

  // 获取排行榜统计信息
  static async getLeaderboardStats(leaderboardId: number) {
    try {
      const [stats] = await pool.query<RowDataPacket[]>(
        `SELECT 
           COUNT(DISTINCT user_id) as total_participants,
           AVG(score) as average_score,
           MAX(score) as highest_score,
           MIN(score) as lowest_score,
           COUNT(*) as total_records
         FROM leaderboard_records 
         WHERE leaderboard_id = ?`,
        [leaderboardId]
      )

      return stats[0] || {}
    } catch (error) {
      console.error('获取排行榜统计信息失败:', error)
      throw error
    }
  }
}
