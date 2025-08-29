// apps/backend/src/services/learning-progress.service.ts

import type { PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import { pool } from '../config/database.js'

// ==== 导出给 controller 用的类型 ====

// getProgressStats 返回
export type ProgressStats = {
  dailyStats: Array<{
    date: string
    total_study_time: number
    total_questions: number
    correct_answers: number
    avg_accuracy: number
  }>
  totalStats: {
    total_study_time: number
    total_questions: number
    correct_answers: number
    avg_accuracy: number
    study_days: number
  }
  period: string
}

// getLearningReport 返回
export type LearningReport = {
  period: string
  statistics: {
    total_study_time: number
    total_questions: number
    correct_questions: number
    avg_accuracy: number
    max_streak: number
    study_days: number
  }
  goals: {
    total_goals: number
    completed_goals: number
    in_progress_goals: number
  }
  achievements: {
    total_achievements: number
  }
  generatedAt: string
}

// getProgressRecords 返回单条记录（对外类型）
export type ProgressRecord = {
  id: number
  user_id: number
  subject_id: number
  subject: number | null
  questions_count: number
  correct_count: number
  study_time: number
  accuracy_rate: number
  created_at: string
}

// getSubjects 返回单条（对外类型）
export type Subject = {
  id: number
  name: string
}

// ====== 内部用：所有 execute<T>() 的 T 都必须是 RowDataPacket[] 等 ======
interface TodayAggRow extends RowDataPacket {
  total_study_time: number | null
  total_questions: number | null
  correct_questions: number | null
}

interface StreakRow extends RowDataPacket {
  streak: number
}

interface DailyRow extends RowDataPacket {
  date: string
  total_study_time: number | null
  total_questions: number | null
  correct_answers: number | null
  avg_accuracy: number | null
}

interface TotalRow extends RowDataPacket {
  total_study_time: number | null
  total_questions: number | null
  correct_answers: number | null
  avg_accuracy: number | null
  study_days: number | null
}

interface StatsRow extends RowDataPacket {
  total_study_time: number | null
  total_questions: number | null
  correct_questions: number | null
  avg_accuracy: number | null
  max_streak: number | null
  study_days: number | null
}

interface GoalsRow extends RowDataPacket {
  total_goals: number | null
  completed_goals: number | null
  in_progress_goals: number | null
}

interface AchRow extends RowDataPacket {
  total_achievements: number | null
}

interface ProgressRecordRow extends RowDataPacket {
  id: number
  user_id: number
  subject_id: number
  subject: number | null
  questions_count: number
  correct_count: number
  study_time: number
  accuracy_rate: number
  created_at: string
}

interface SubjectRow extends RowDataPacket {
  id: number
  name: string
}

// ====== 业务实体（本来就继承了 RowDataPacket） ======
export interface LearningProgress extends RowDataPacket {
  id: number
  user_id: number
  subject_id?: number
  study_date: string
  time_spent: number
  total_questions: number
  correct_answers: number
  accuracy_rate: number
  created_at: string
  updated_at: string
}

export interface LearningGoal extends RowDataPacket {
  id: number
  user_id: number
  goal_type: string
  target_value: number
  current_value: number
  start_date: string
  end_date: string
  status: string
  subject_id?: number
  description?: string
  created_at: string
  updated_at: string
}

export interface LearningTrack extends RowDataPacket {
  id: number
  user_id: number
  activity_type: string
  activity_data: string
  subject_id?: number
  created_at: string
}

export interface LearningStatistics extends RowDataPacket {
  id: number
  user_id: number
  subject_id?: number
  stat_date: string
  total_study_time: number
  total_questions: number
  correct_questions: number
  accuracy_rate: number
  study_streak: number
  created_at: string
  updated_at: string
}

export interface LearningAchievement extends RowDataPacket {
  id: number
  user_id: number
  achievement_type: string
  achievement_name: string
  achievement_description: string
  achievement_data: string
  unlocked_at: string
}

export interface LearningProgressData {
  userId: number
  subjectId?: number
  studyTime: number
  questionsAnswered: number
  correctAnswers: number
  studyContent?: string
}

export interface LearningGoalData {
  userId: number
  goalType: string
  targetValue: number
  startDate: string
  endDate: string
  subjectId?: number
  description?: string
}

export class LearningProgressService {
  // 记录学习进度
  async recordProgress(data: LearningProgressData): Promise<LearningProgress> {
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()

      const accuracyRate = data.questionsAnswered > 0 ? (data.correctAnswers / data.questionsAnswered) * 100 : 0

      // 插入学习进度记录
      await connection.execute<ResultSetHeader>(
        `INSERT INTO learning_progress 
         (user_id, subject_id, study_date, time_spent, total_questions, correct_answers, accuracy_rate)
         VALUES (?, ?, CURDATE(), ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           time_spent     = time_spent + VALUES(time_spent),
           total_questions= total_questions + VALUES(total_questions),
           correct_answers= correct_answers + VALUES(correct_answers),
           accuracy_rate  = (correct_answers / total_questions) * 100,
           updated_at     = CURRENT_TIMESTAMP`,
        [data.userId, data.subjectId ?? null, data.studyTime, data.questionsAnswered, data.correctAnswers, accuracyRate]
      )

      // 记录学习轨迹
      await connection.execute<ResultSetHeader>(
        `INSERT INTO learning_tracks (user_id, activity_type, activity_data, subject_id)
         VALUES (?, 'study_session', ?, ?)`,
        [
          data.userId,
          JSON.stringify({
            studyTime: data.studyTime,
            questionsAnswered: data.questionsAnswered,
            correctAnswers: data.correctAnswers,
            accuracyRate,
          }),
          data.subjectId ?? null,
        ]
      )

      // 更新学习统计
      await this.updateLearningStatistics(connection, data.userId, data.subjectId)

      await connection.commit()

      // 获取更新后的进度记录
      const [progressRows] = await connection.execute<LearningProgress[]>(
        `SELECT * FROM learning_progress 
         WHERE user_id = ? AND subject_id <=> ? AND study_date = CURDATE()`,
        [data.userId, data.subjectId ?? null]
      )

      return progressRows[0]
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  // 更新学习统计
  private async updateLearningStatistics(
    connection: PoolConnection,
    userId: number,
    subjectId?: number
  ): Promise<void> {
    const today = new Date().toISOString().split('T')[0]

    // 今日聚合
    const [todayRows] = await connection.execute<TodayAggRow[]>(
      `SELECT 
         SUM(time_spent)      AS total_study_time,
         SUM(total_questions) AS total_questions,
         SUM(correct_answers) AS correct_questions
       FROM learning_progress 
       WHERE user_id = ? AND subject_id <=> ? AND study_date = ?`,
      [userId, subjectId ?? null, today]
    )

    const data = todayRows[0] ?? { total_study_time: 0, total_questions: 0, correct_questions: 0 }
    const totalStudyTime = data.total_study_time ?? 0
    const totalQuestions = data.total_questions ?? 0
    const correctQuestions = data.correct_questions ?? 0
    const accuracyRate = totalQuestions > 0 ? (correctQuestions / totalQuestions) * 100 : 0

    // 连续天数
    const [streakRows] = await connection.execute<StreakRow[]>(
      `SELECT COUNT(*) AS streak FROM (
         SELECT study_date
         FROM learning_progress 
         WHERE user_id = ? AND subject_id <=> ?
           AND study_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
         GROUP BY study_date
       ) AS daily_study`,
      [userId, subjectId ?? null]
    )
    const streak = streakRows[0]?.streak ?? 0

    // 写入统计
    await connection.execute<ResultSetHeader>(
      `INSERT INTO learning_statistics 
         (user_id, subject_id, stat_date, total_study_time, total_questions, correct_questions, accuracy_rate, study_streak)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         total_study_time = VALUES(total_study_time),
         total_questions  = VALUES(total_questions),
         correct_questions= VALUES(correct_questions),
         accuracy_rate    = VALUES(accuracy_rate),
         study_streak     = VALUES(study_streak),
         updated_at       = CURRENT_TIMESTAMP`,
      [userId, subjectId ?? null, today, totalStudyTime, totalQuestions, correctQuestions, accuracyRate, streak]
    )
  }

  // 获取学习进度统计
  async getProgressStats(userId: number, period: string, subjectId?: number): Promise<ProgressStats> {
    let days = 7
    switch (period) {
      case '7d':
        days = 7
        break
      case '30d':
        days = 30
        break
      case '90d':
        days = 90
        break
      default:
        days = 7
    }
    const dateCondition = `AND study_date >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)`
    const subjectCondition = subjectId ? 'AND subject_id = ?' : ''
    const params = (subjectId != null ? [userId, subjectId] : [userId]) as [number, number] | [number]

    const [rows] = await pool.execute<DailyRow[]>(
      `SELECT 
         DATE(study_date)                AS date,
         SUM(time_spent)                 AS total_study_time,
         SUM(total_questions)            AS total_questions,
         SUM(correct_answers)            AS correct_answers,
         AVG(accuracy_rate)              AS avg_accuracy
       FROM learning_progress 
       WHERE user_id = ? ${subjectCondition} ${dateCondition}
       GROUP BY DATE(study_date)
       ORDER BY DATE(study_date) ASC`,
      params
    )

    const [totalRows] = await pool.execute<TotalRow[]>(
      `SELECT 
         SUM(time_spent)            AS total_study_time,
         SUM(total_questions)       AS total_questions,
         SUM(correct_answers)       AS correct_answers,
         AVG(accuracy_rate)         AS avg_accuracy,
         COUNT(DISTINCT study_date) AS study_days
       FROM learning_progress 
       WHERE user_id = ? ${subjectCondition} ${dateCondition}`,
      params
    )

    return {
      dailyStats: rows.map(r => ({
        date: r.date,
        total_study_time: r.total_study_time ?? 0,
        total_questions: r.total_questions ?? 0,
        correct_answers: r.correct_answers ?? 0,
        avg_accuracy: r.avg_accuracy ?? 0,
      })),
      totalStats: {
        total_study_time: totalRows[0]?.total_study_time ?? 0,
        total_questions: totalRows[0]?.total_questions ?? 0,
        correct_answers: totalRows[0]?.correct_answers ?? 0,
        avg_accuracy: totalRows[0]?.avg_accuracy ?? 0,
        study_days: totalRows[0]?.study_days ?? 0,
      },
      period,
    }
  }

  // 获取学习轨迹
  async getLearningTrack(
    userId: number,
    startDate: string,
    endDate: string,
    subjectId?: number
  ): Promise<LearningTrack[]> {
    const subjectCondition = subjectId ? 'AND subject_id = ?' : ''
    const params = (subjectId != null ? [userId, startDate, endDate, subjectId] : [userId, startDate, endDate]) as
      | [number, string, string, number]
      | [number, string, string]

    const [rows] = await pool.execute<LearningTrack[]>(
      `SELECT * FROM learning_tracks 
       WHERE user_id = ? AND DATE(created_at) BETWEEN ? AND ? ${subjectCondition}
       ORDER BY created_at DESC`,
      params
    )
    return rows
  }

  // 设置学习目标
  async setLearningGoal(data: LearningGoalData): Promise<LearningGoal> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO learning_goals 
         (user_id, goal_type, target_value, start_date, end_date, subject_id, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.userId,
        data.goalType,
        data.targetValue,
        data.startDate,
        data.endDate,
        data.subjectId ?? null,
        data.description ?? null,
      ]
    )

    const [rows] = await pool.execute<LearningGoal[]>('SELECT * FROM learning_goals WHERE id = ?', [result.insertId])
    return rows[0]
  }

  // 获取学习目标
  async getLearningGoals(userId: number, status?: string, goalType?: string): Promise<LearningGoal[]> {
    const where: string[] = ['user_id = ?']
    const params: Array<string | number | null> = [userId]

    if (status) {
      where.push('status = ?')
      params.push(status)
    }
    if (goalType) {
      where.push('goal_type = ?')
      params.push(goalType)
    }

    const [rows] = await pool.execute<LearningGoal[]>(
      `SELECT * FROM learning_goals 
       WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC`,
      params
    )
    return rows
  }

  // 更新学习目标进度
  async updateGoalProgress(
    goalId: number,
    userId: number,
    currentValue: number,
    status?: string
  ): Promise<LearningGoal> {
    const updateFields: string[] = ['current_value = ?', 'updated_at = CURRENT_TIMESTAMP']
    const params: Array<string | number> = [currentValue]

    if (status) {
      updateFields.push('status = ?')
      params.push(status)
    }

    params.push(goalId, userId)

    await pool.execute<ResultSetHeader>(
      `UPDATE learning_goals SET ${updateFields.join(', ')}
       WHERE id = ? AND user_id = ?`,
      params
    )

    const [rows] = await pool.execute<LearningGoal[]>('SELECT * FROM learning_goals WHERE id = ? AND user_id = ?', [
      goalId,
      userId,
    ])
    return rows[0]
  }

  // 获取学习成就
  async getLearningAchievements(userId: number): Promise<LearningAchievement[]> {
    const [rows] = await pool.execute<LearningAchievement[]>(
      'SELECT * FROM learning_achievements WHERE user_id = ? ORDER BY unlocked_at DESC',
      [userId]
    )
    return rows
  }

  // 解锁学习成就
  async unlockAchievement(userId: number, achievementType: string, achievementData: any): Promise<LearningAchievement> {
    // 检查是否已经解锁该成就
    const [existing] = await pool.execute<LearningAchievement[]>(
      'SELECT * FROM learning_achievements WHERE user_id = ? AND achievement_type = ?',
      [userId, achievementType]
    )
    if (existing.length > 0) return existing[0]

    // 根据成就类型生成成就信息
    const achievementInfo = this.getAchievementInfo(achievementType, achievementData)

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO learning_achievements 
         (user_id, achievement_type, achievement_name, achievement_description, achievement_data)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, achievementType, achievementInfo.name, achievementInfo.description, JSON.stringify(achievementData)]
    )

    const [rows] = await pool.execute<LearningAchievement[]>('SELECT * FROM learning_achievements WHERE id = ?', [
      result.insertId,
    ])
    return rows[0]
  }

  // 获取成就信息
  private getAchievementInfo(achievementType: string, _data: any): { name: string; description: string } {
    const achievements: Record<string, { name: string; description: string }> = {
      first_study: { name: '初学者', description: '完成第一次学习' },
      study_streak_7: { name: '坚持不懈', description: '连续学习7天' },
      study_streak_30: { name: '学习达人', description: '连续学习30天' },
      questions_100: { name: '百题斩', description: '累计答题100道' },
      questions_1000: { name: '千题王', description: '累计答题1000道' },
      accuracy_90: { name: '精准射手', description: '单日正确率达到90%' },
      study_time_10h: { name: '勤奋学者', description: '单日学习时长达到10小时' },
    }
    return achievements[achievementType] || { name: '未知成就', description: '未知成就描述' }
  }

  // 获取学习报告
  async getLearningReport(userId: number, period: string, subjectId?: number): Promise<LearningReport> {
    let days = 30
    switch (period) {
      case 'week':
        days = 7
        break
      case 'month':
        days = 30
        break
      case 'quarter':
        days = 90
        break
      case 'year':
        days = 365
        break
      default:
        days = 30
    }

    const dateCondition = `AND stat_date >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)`
    const subjectCondition = subjectId ? 'AND subject_id = ?' : ''
    const params = (subjectId != null ? [userId, subjectId] : [userId]) as [number, number] | [number]

    // 统计
    const [statsRows] = await pool.execute<StatsRow[]>(
      `SELECT 
         SUM(total_study_time)  AS total_study_time,
         SUM(total_questions)   AS total_questions,
         SUM(correct_questions) AS correct_questions,
         AVG(accuracy_rate)     AS avg_accuracy,
         MAX(study_streak)      AS max_streak,
         COUNT(DISTINCT stat_date) AS study_days
       FROM learning_statistics 
       WHERE user_id = ? ${subjectCondition} ${dateCondition}`,
      params
    )
    const statistics = {
      total_study_time: statsRows[0]?.total_study_time ?? 0,
      total_questions: statsRows[0]?.total_questions ?? 0,
      correct_questions: statsRows[0]?.correct_questions ?? 0,
      avg_accuracy: statsRows[0]?.avg_accuracy ?? 0,
      max_streak: statsRows[0]?.max_streak ?? 0,
      study_days: statsRows[0]?.study_days ?? 0,
    }

    // 目标
    const [goalsRows] = await pool.execute<GoalsRow[]>(
      `SELECT 
         COUNT(*) AS total_goals,
         SUM(CASE WHEN status = 'completed'  THEN 1 ELSE 0 END) AS completed_goals,
         SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_goals
       FROM learning_goals 
       WHERE user_id = ? ${subjectCondition} 
         AND start_date >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)`,
      params
    )
    const goals = {
      total_goals: goalsRows[0]?.total_goals ?? 0,
      completed_goals: goalsRows[0]?.completed_goals ?? 0,
      in_progress_goals: goalsRows[0]?.in_progress_goals ?? 0,
    }

    // 成就
    const [achievementsRows] = await pool.execute<AchRow[]>(
      `SELECT COUNT(*) AS total_achievements
       FROM learning_achievements 
       WHERE user_id = ? 
         AND unlocked_at >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)`,
      [userId]
    )
    const achievements = {
      total_achievements: achievementsRows[0]?.total_achievements ?? 0,
    }

    return {
      period,
      statistics,
      goals,
      achievements,
      generatedAt: new Date().toISOString(),
    }
  }

  // 获取学习记录
  async getProgressRecords(
    userId: number,
    startDate: string,
    endDate: string,
    subject?: string,
    limit: number = 20
  ): Promise<ProgressRecord[]> {
    // 构建动态SQL查询
    let sql = `SELECT 
         lp.id,
         lp.user_id,
         COALESCE(lp.subject_id, 0)      AS subject_id,
         lp.subject_id                    AS subject,
         lp.total_questions               AS questions_count,
         lp.correct_answers               AS correct_count,
         lp.time_spent                    AS study_time,
         lp.accuracy_rate                 AS accuracy_rate,
         lp.study_date                    AS created_at
       FROM learning_progress lp
       WHERE 1=1`

    if (userId) {
      sql += ` AND lp.user_id = ${Number(userId)}`
    }

    if (subject && subject !== 'all') {
      const sid = Number.parseInt(subject as string, 10)
      if (!Number.isNaN(sid)) {
        sql += ` AND lp.subject_id = ${sid}`
      }
    }

    if (startDate && endDate) {
      sql += ` AND lp.study_date >= '${startDate}' AND lp.study_date <= '${endDate}'`
    }

    sql += ' ORDER BY lp.study_date DESC, lp.id DESC'

    if (limit) {
      sql += ` LIMIT ${Number.parseInt(String(limit), 10)}`
    }

    const [rows] = await pool.query<ProgressRecordRow[]>(sql)
    // 结构一致，可直接断言为外部暴露的类型
    return rows as unknown as ProgressRecord[]
  }

  // 获取科目列表
  async getSubjects(userId: number): Promise<Subject[]> {
    const [rows] = await pool.execute<SubjectRow[]>(
      `SELECT DISTINCT 
         COALESCE(lp.subject_id, 0)                                  AS id,
         CONCAT('科目 ', COALESCE(CAST(lp.subject_id AS CHAR), '未分类')) AS name
       FROM learning_progress lp
       WHERE lp.user_id = ? AND lp.subject_id IS NOT NULL
       ORDER BY id`,
      [userId]
    )
    return rows as unknown as Subject[]
  }
}
