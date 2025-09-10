import { pool } from '@/config/database.js'
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type {
  LearningAchievement,
  LearningGoal,
  LearningTrack,
  ProgressRecord,
  Subject,
} from '../domain/learning-progress.model.js'

type TodayAggRow = RowDataPacket & {
  total_study_time: number | null
  total_questions: number | null
  correct_questions: number | null
}
type StreakRow = RowDataPacket & { streak: number }
type DailyRow = RowDataPacket & {
  date: string
  total_study_time: number | null
  total_questions: number | null
  correct_answers: number | null
  avg_accuracy: number | null
}
type TotalRow = RowDataPacket & {
  total_study_time: number | null
  total_questions: number | null
  correct_answers: number | null
  avg_accuracy: number | null
  study_days: number | null
}
type StatsRow = RowDataPacket & {
  total_study_time: number | null
  total_questions: number | null
  correct_questions: number | null
  avg_accuracy: number | null
  max_streak: number | null
  study_days: number | null
}
type GoalsRow = RowDataPacket & {
  total_goals: number | null
  completed_goals: number | null
  in_progress_goals: number | null
}
type AchRow = RowDataPacket & { total_achievements: number | null }
type ProgressRecordRow = RowDataPacket & ProgressRecord
type SubjectRow = RowDataPacket & Subject

export class LearningProgressRepository {
  // progress insert/merge
  async upsertProgress(
    conn: PoolConnection,
    userId: number,
    subjectId: number | null,
    studyTime: number,
    q: number,
    c: number,
    acc: number
  ) {
    await conn.execute<ResultSetHeader>(
      `INSERT INTO learning_progress 
       (user_id, subject_id, study_date, time_spent, total_questions, correct_answers, accuracy_rate)
       VALUES (?, ?, CURDATE(), ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         time_spent = time_spent + VALUES(time_spent),
         total_questions = total_questions + VALUES(total_questions),
         correct_answers = correct_answers + VALUES(correct_answers),
         accuracy_rate = (correct_answers / total_questions) * 100,
         updated_at = CURRENT_TIMESTAMP`,
      [userId, subjectId, studyTime, q, c, acc]
    )
  }

  async insertTrack(conn: PoolConnection, userId: number, payload: any, subjectId: number | null) {
    await conn.execute<ResultSetHeader>(
      `INSERT INTO learning_tracks (user_id, activity_type, activity_data, subject_id)
       VALUES (?, 'study_session', ?, ?)`,
      [userId, JSON.stringify(payload), subjectId]
    )
  }

  async aggregateToday(conn: PoolConnection, userId: number, subjectId: number | null, dateISO: string) {
    const [rows] = await conn.execute<TodayAggRow[]>(
      `SELECT 
         SUM(time_spent) AS total_study_time,
         SUM(total_questions) AS total_questions,
         SUM(correct_answers) AS correct_questions
       FROM learning_progress
       WHERE user_id=? AND subject_id <=> ? AND study_date=?`,
      [userId, subjectId, dateISO]
    )
    return rows[0]
  }

  async streak(conn: PoolConnection, userId: number, subjectId: number | null) {
    const [rows] = await conn.execute<StreakRow[]>(
      `SELECT COUNT(*) AS streak
       FROM (SELECT study_date FROM learning_progress
             WHERE user_id=? AND subject_id <=> ?
               AND study_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
             GROUP BY study_date) t`,
      [userId, subjectId]
    )
    return rows[0]?.streak ?? 0
  }

  async upsertStatistics(
    conn: PoolConnection,
    userId: number,
    subjectId: number | null,
    dateISO: string,
    agg: { study: number; q: number; c: number; acc: number; streak: number }
  ) {
    await conn.execute<ResultSetHeader>(
      `INSERT INTO learning_statistics
       (user_id, subject_id, stat_date, total_study_time, total_questions, correct_questions, accuracy_rate, study_streak)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         total_study_time=VALUES(total_study_time),
         total_questions=VALUES(total_questions),
         correct_questions=VALUES(correct_questions),
         accuracy_rate=VALUES(accuracy_rate),
         study_streak=VALUES(study_streak),
         updated_at=CURRENT_TIMESTAMP`,
      [userId, subjectId, dateISO, agg.study, agg.q, agg.c, agg.acc, agg.streak]
    )
  }

  async dailyStats(userId: number, subjectId: number | undefined, days: number) {
    const subjectCond = subjectId ? 'AND subject_id = ?' : ''
    const params = (subjectId ? [userId, subjectId] : [userId]) as any[]
    const [rows] = await pool.execute<DailyRow[]>(
      `SELECT DATE(study_date) AS date,
              SUM(time_spent) AS total_study_time,
              SUM(total_questions) AS total_questions,
              SUM(correct_answers) AS correct_answers,
              AVG(accuracy_rate) AS avg_accuracy
       FROM learning_progress
       WHERE user_id=? ${subjectCond} AND study_date >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)
       GROUP BY DATE(study_date)
       ORDER BY DATE(study_date) ASC`,
      params
    )
    return rows
  }

  async totalStats(userId: number, subjectId: number | undefined, days: number) {
    const subjectCond = subjectId ? 'AND subject_id = ?' : ''
    const params = (subjectId ? [userId, subjectId] : [userId]) as any[]
    const [rows] = await pool.execute<TotalRow[]>(
      `SELECT SUM(time_spent) AS total_study_time,
              SUM(total_questions) AS total_questions,
              SUM(correct_answers) AS correct_answers,
              AVG(accuracy_rate) AS avg_accuracy,
              COUNT(DISTINCT study_date) AS study_days
       FROM learning_progress
       WHERE user_id=? ${subjectCond} AND study_date >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)`,
      params
    )
    return rows[0]
  }

  async getTrack(userId: number, start: string, end: string, subjectId?: number) {
    const subjectCond = subjectId ? 'AND subject_id = ?' : ''
    const params = (subjectId ? [userId, start, end, subjectId] : [userId, start, end]) as any[]
    const [rows] = await pool.execute<LearningTrack[]>(
      `SELECT * FROM learning_tracks
       WHERE user_id=? AND DATE(created_at) BETWEEN ? AND ? ${subjectCond}
       ORDER BY created_at DESC`,
      params
    )
    return rows
  }

  async insertGoal(data: {
    userId: number
    goalType: string
    targetValue: number
    startDate: string
    endDate: string
    subjectId?: number
    description?: string
  }) {
    const [ret] = await pool.execute<ResultSetHeader>(
      `INSERT INTO learning_goals (user_id, goal_type, target_value, start_date, end_date, subject_id, description)
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
    const [rows] = await pool.execute<LearningGoal[]>('SELECT * FROM learning_goals WHERE id=?', [ret.insertId])
    return rows[0]
  }

  async listGoals(userId: number, status?: string, goalType?: string) {
    const where: string[] = ['user_id=?']
    const p: any[] = [userId]
    if (status) {
      where.push('status=?')
      p.push(status)
    }
    if (goalType) {
      where.push('goal_type=?')
      p.push(goalType)
    }
    const [rows] = await pool.execute<LearningGoal[]>(
      `SELECT * FROM learning_goals WHERE ${where.join(' AND ')} ORDER BY created_at DESC`,
      p
    )
    return rows
  }

  async updateGoal(goalId: number, userId: number, currentValue: number, status?: string) {
    const sets: string[] = ['current_value=?', 'updated_at=CURRENT_TIMESTAMP']
    const p: any[] = [currentValue]
    if (status) {
      sets.push('status=?')
      p.push(status)
    }
    p.push(goalId, userId)
    await pool.execute<ResultSetHeader>(`UPDATE learning_goals SET ${sets.join(', ')} WHERE id=? AND user_id=?`, p)
    const [rows] = await pool.execute<LearningGoal[]>('SELECT * FROM learning_goals WHERE id=? AND user_id=?', [
      goalId,
      userId,
    ])
    return rows[0]
  }

  async listAchievements(userId: number) {
    const [rows] = await pool.execute<LearningAchievement[]>(
      `SELECT * FROM learning_achievements WHERE user_id=? ORDER BY unlocked_at DESC`,
      [userId]
    )
    return rows
  }

  async findAchievement(userId: number, type: string) {
    const [rows] = await pool.execute<LearningAchievement[]>(
      `SELECT * FROM learning_achievements WHERE user_id=? AND achievement_type=? LIMIT 1`,
      [userId, type]
    )
    return rows[0]
  }

  async insertAchievement(userId: number, payload: { type: string; name: string; description: string; data: any }) {
    const [ret] = await pool.execute<ResultSetHeader>(
      `INSERT INTO learning_achievements (user_id, achievement_type, achievement_name, achievement_description, achievement_data)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, payload.type, payload.name, payload.description, JSON.stringify(payload.data)]
    )
    const [rows] = await pool.execute<LearningAchievement[]>(`SELECT * FROM learning_achievements WHERE id=?`, [
      ret.insertId,
    ])
    return rows[0]
  }

  async listRecords(userId: number, start?: string, end?: string, subject?: string, limit = 20) {
    let sql = `SELECT 
         lp.id, lp.user_id,
         COALESCE(lp.subject_id, 0) AS subject_id,
         lp.subject_id AS subject,
         lp.total_questions AS questions_count,
         lp.correct_answers AS correct_count,
         lp.time_spent AS study_time,
         lp.accuracy_rate AS accuracy_rate,
         lp.study_date AS created_at
       FROM learning_progress lp
       WHERE 1=1`
    if (userId) sql += ` AND lp.user_id=${Number(userId)}`
    if (subject && subject !== 'all') {
      const sid = Number.parseInt(subject, 10)
      if (!Number.isNaN(sid)) sql += ` AND lp.subject_id=${sid}`
    }
    if (start && end) sql += ` AND lp.study_date >= '${start}' AND lp.study_date <= '${end}'`
    sql += ` ORDER BY lp.study_date DESC, lp.id DESC`
    if (limit) sql += ` LIMIT ${Number.parseInt(String(limit), 10)}`
    const [rows] = await pool.query<ProgressRecordRow[]>(sql)
    return rows as unknown as ProgressRecord[]
  }

  async listSubjects(userId: number) {
    const [rows] = await pool.execute<SubjectRow[]>(
      `SELECT DISTINCT 
         COALESCE(lp.subject_id, 0) AS id,
         CONCAT('科目 ', COALESCE(CAST(lp.subject_id AS CHAR), '未分类')) AS name
       FROM learning_progress lp
       WHERE lp.user_id=? AND lp.subject_id IS NOT NULL
       ORDER BY id`,
      [userId]
    )
    return rows as unknown as Subject[]
  }

  // report aggregates
  async reportStats(userId: number, subjectId: number | undefined, days: number) {
    const subjectCond = subjectId ? 'AND subject_id=?' : ''
    const params = (subjectId ? [userId, subjectId] : [userId]) as any[]
    const [rows] = await pool.execute<StatsRow[]>(
      `SELECT 
         SUM(total_study_time)  AS total_study_time,
         SUM(total_questions)   AS total_questions,
         SUM(correct_questions) AS correct_questions,
         AVG(accuracy_rate)     AS avg_accuracy,
         MAX(study_streak)      AS max_streak,
         COUNT(DISTINCT stat_date) AS study_days
       FROM learning_statistics
       WHERE user_id=? ${subjectCond}
         AND stat_date >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)`,
      params
    )
    return rows[0]
  }

  async reportGoals(userId: number, subjectId: number | undefined, days: number) {
    const subjectCond = subjectId ? 'AND subject_id=?' : ''
    const params = (subjectId ? [userId, subjectId] : [userId]) as any[]
    const [rows] = await pool.execute<GoalsRow[]>(
      `SELECT 
         COUNT(*) AS total_goals,
         SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed_goals,
         SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) AS in_progress_goals
       FROM learning_goals
       WHERE user_id=? ${subjectCond}
         AND start_date >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)`,
      params
    )
    return rows[0]
  }

  async reportAchievements(userId: number, days: number) {
    const [rows] = await pool.execute<AchRow[]>(
      `SELECT COUNT(*) AS total_achievements
       FROM learning_achievements
       WHERE user_id=? AND unlocked_at >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)`,
      [userId]
    )
    return rows[0]
  }
}
