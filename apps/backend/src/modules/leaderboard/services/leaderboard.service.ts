import { pool } from '@/config/database.js'
import type { PoolConnection, RowDataPacket } from 'mysql2/promise'
import { LeaderboardRepository } from '../repositories/leaderboard.repository.js'
import { CompetitionRepository } from '../repositories/competition.repository.js'
import { AchievementRepository } from '../repositories/achievement.repository.js'
import type { Competition, Leaderboard, LeaderboardRecord } from '../domain/leaderboard.types.js'

export class LeaderboardService {
  private lbRepo = new LeaderboardRepository()
  private compRepo = new CompetitionRepository()
  private achRepo = new AchievementRepository()

  // —— Leaderboards ——
  listLeaderboards(q: { category?: string; type?: string; active?: string }) {
    return this.lbRepo.list(q)
  }

  async getLeaderboardWithRecords(id: number, page = 1, limit = 50) {
    const lb = await this.lbRepo.findById(id)
    if (!lb) return { leaderboard: null, records: [] as LeaderboardRecord[] }
    const offset = (Math.max(page, 1) - 1) * Math.min(Math.max(limit, 1), 100)
    const records = await this.lbRepo.listRecords(id, Math.min(Math.max(limit, 1), 100), offset)
    return { leaderboard: lb, records }
  }

  async getUserRankAndTotal(leaderboardId: number, userId: number) {
    const rank = await this.lbRepo.getUserLatestRank(leaderboardId, userId)
    const total = await this.lbRepo.countParticipants(leaderboardId)
    return { rank, total }
  }

  async recalcLeaderboard(leaderboardId: number) {
    const lb = await this.lbRepo.findById(leaderboardId)
    if (!lb) throw new Error('NOT_FOUND')
    await this.calculateRanks(lb)
  }

  async getUserBestRanks(userId: number) {
    return this.lbRepo.getUserBestRanks(userId)
  }

  getStats(leaderboardId: number) {
    return this.lbRepo.getStats(leaderboardId)
  }

  // —— Competitions ——
  listCompetitions(q: { status?: string; type?: string }) {
    return this.compRepo.list(q)
  }

  async joinCompetition(userId: number, competitionId: number, teamName: string | null) {
    const comp = await this.compRepo.findOpenForRegistration(competitionId)
    if (!comp) throw new Error('NOT_OPEN')
    if (await this.compRepo.existsUserJoined(competitionId, userId)) throw new Error('DUP')
    if (comp.max_participants) {
      const cnt = await this.compRepo.countParticipants(competitionId)
      if (cnt >= comp.max_participants) throw new Error('FULL')
    }
    await this.compRepo.insertParticipant(competitionId, userId, teamName)
  }

  // —— Achievements ——
  listUserAchievements(userId: number) {
    return this.achRepo.listByUser(userId)
  }

  private async recordAchievementIfNotExists(
    userId: number,
    type: string,
    name: string,
    desc: string,
    leaderboardId?: number,
    competitionId?: number,
    metadata?: any
  ) {
    const exist = await this.achRepo.exists(userId, type, leaderboardId ?? null, competitionId ?? null)
    if (!exist)
      await this.achRepo.insert(userId, type, name, desc, leaderboardId ?? null, competitionId ?? null, metadata)
  }

  // —— Rank Calculations ——
  private async calculateRanks(leaderboard: Leaderboard) {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      switch (leaderboard.type) {
        case 'score':
          await this.calculateScoreRanks(conn, leaderboard)
          break
        case 'time':
          await this.calculateTimeRanks(conn, leaderboard)
          break
        case 'accuracy':
          await this.calculateAccuracyRanks(conn, leaderboard)
          break
        case 'progress':
          await this.calculateProgressRanks(conn, leaderboard)
          break
      }
      await conn.commit()
      await this.checkRankingAchievements(leaderboard.id)
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  }

  private async checkRankingAchievements(leaderboardId: number) {
    const today = new Date().toISOString().split('T')[0]
    const [records] = await pool.query<LeaderboardRecord[]>(
      `SELECT lr.*
       FROM leaderboard_records lr
       WHERE lr.leaderboard_id=? AND lr.record_date=? 
       ORDER BY lr.rank_position ASC
       LIMIT 100`,
      [leaderboardId, today]
    )
    const lb = await this.lbRepo.findById(leaderboardId)
    if (!lb) return
    for (const r of records) {
      if (r.rank_position === 1)
        await this.recordAchievementIfNotExists(
          r.user_id,
          'top1',
          `${lb.name} - 第一名`,
          `在 ${lb.name} 中获得第一名`,
          leaderboardId,
          undefined,
          { rank: 1, score: r.score, date: r.record_date }
        )
      if (r.rank_position <= 3)
        await this.recordAchievementIfNotExists(
          r.user_id,
          'top3',
          `${lb.name} - 前三名`,
          `在 ${lb.name} 中获得前三名`,
          leaderboardId,
          undefined,
          { rank: r.rank_position, score: r.score, date: r.record_date }
        )
      if (r.rank_position <= 10)
        await this.recordAchievementIfNotExists(
          r.user_id,
          'top10',
          `${lb.name} - 前十名`,
          `在 ${lb.name} 中获得前十名`,
          leaderboardId,
          undefined,
          { rank: r.rank_position, score: r.score, date: r.record_date }
        )
      if (r.rank_position <= 100)
        await this.recordAchievementIfNotExists(
          r.user_id,
          'top100',
          `${lb.name} - 前一百名`,
          `在 ${lb.name} 中获得前一百名`,
          leaderboardId,
          undefined,
          { rank: r.rank_position, score: r.score, date: r.record_date }
        )
    }
  }

  private async wipeAndInsert(
    conn: PoolConnection,
    leaderboardId: number,
    rows: any[],
    today: string,
    extraKey?: string
  ) {
    await this.lbRepo.deleteRecordsForDate(leaderboardId, today)
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      await this.lbRepo.insertRank(
        leaderboardId,
        r.user_id,
        Number(r.total_score ?? r.total_time ?? r.accuracy_rate ?? r.progress_score ?? 0),
        i + 1,
        today,
        extraKey ? { [extraKey]: r[extraKey] } : undefined
      )
    }
  }

  private async calculateScoreRanks(conn: PoolConnection, lb: Leaderboard) {
    const today = new Date().toISOString().split('T')[0]
    let sql = ''
    const p: any[] = []
    switch (lb.category) {
      case 'global':
        sql = `SELECT user_id, SUM(score) AS total_score FROM exam_results WHERE status='submitted' GROUP BY user_id ORDER BY total_score DESC`
        break
      case 'monthly':
        sql = `SELECT user_id, SUM(score) AS total_score FROM exam_results WHERE status='submitted' AND DATE_FORMAT(submit_time,'%Y-%m')=DATE_FORMAT(NOW(),'%Y-%m') GROUP BY user_id ORDER BY total_score DESC`
        break
      case 'weekly':
        sql = `SELECT user_id, SUM(score) AS total_score FROM exam_results WHERE status='submitted' AND YEARWEEK(submit_time)=YEARWEEK(NOW()) GROUP BY user_id ORDER BY total_score DESC`
        break
      case 'daily':
        sql = `SELECT user_id, SUM(score) AS total_score FROM exam_results WHERE status='submitted' AND DATE(submit_time)=CURDATE() GROUP BY user_id ORDER BY total_score DESC`
        break
      case 'subject':
        if (lb.subject_id) {
          sql = `SELECT er.user_id, SUM(er.score) AS total_score FROM exam_results er JOIN exams e ON e.id=er.exam_id WHERE er.status='submitted' AND e.subject_id=? GROUP BY er.user_id ORDER BY total_score DESC`
          p.push(lb.subject_id)
        }
        break
      case 'exam':
        if (lb.exam_id) {
          sql = `SELECT user_id, score AS total_score FROM exam_results WHERE status='submitted' AND exam_id=? ORDER BY total_score DESC`
          p.push(lb.exam_id)
        }
        break
    }
    if (!sql) return
    const [rows] = await conn.query<RowDataPacket[]>(sql, p)
    await this.wipeAndInsert(conn, lb.id, rows as any[], today)
  }

  private async calculateTimeRanks(conn: PoolConnection, lb: Leaderboard) {
    const today = new Date().toISOString().split('T')[0]
    let sql = ''
    switch (lb.category) {
      case 'global':
        sql = `SELECT user_id, SUM(study_time) AS total_time FROM learning_progress GROUP BY user_id ORDER BY total_time DESC`
        break
      case 'weekly':
        sql = `SELECT user_id, SUM(study_time) AS total_time FROM learning_progress WHERE YEARWEEK(created_at)=YEARWEEK(NOW()) GROUP BY user_id ORDER BY total_time DESC`
        break
      case 'monthly':
        sql = `SELECT user_id, SUM(study_time) AS total_time FROM learning_progress WHERE DATE_FORMAT(created_at,'%Y-%m')=DATE_FORMAT(NOW(),'%Y-%m') GROUP BY user_id ORDER BY total_time DESC`
        break
      case 'daily':
        sql = `SELECT user_id, SUM(study_time) AS total_time FROM learning_progress WHERE DATE(created_at)=CURDATE() GROUP BY user_id ORDER BY total_time DESC`
        break
    }
    if (!sql) return
    const [rows] = await conn.query<RowDataPacket[]>(sql)
    await this.wipeAndInsert(conn, lb.id, rows as any[], today, 'study_time')
  }

  private async calculateAccuracyRanks(conn: PoolConnection, lb: Leaderboard) {
    const today = new Date().toISOString().split('T')[0]
    const minQ = lb.calculation_method?.min_questions ?? 50
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT user_id,
              SUM(questions_answered) AS total_questions,
              SUM(correct_answers)    AS total_correct,
              (SUM(correct_answers)/NULLIF(SUM(questions_answered),0)*100) AS accuracy_rate
       FROM learning_progress
       WHERE questions_answered > 0
       GROUP BY user_id
       HAVING total_questions >= ?
       ORDER BY accuracy_rate DESC`,
      [minQ]
    )
    await this.lbRepo.deleteRecordsForDate(lb.id, today)
    for (let i = 0; i < rows.length; i++) {
      const r: any = rows[i]
      await this.lbRepo.insertRank(lb.id, r.user_id, r.accuracy_rate, i + 1, today, {
        total_questions: r.total_questions,
        total_correct: r.total_correct,
        accuracy_rate: r.accuracy_rate,
      })
    }
  }

  private async calculateProgressRanks(conn: PoolConnection, lb: Leaderboard) {
    const today = new Date().toISOString().split('T')[0]
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT user_id,
              SUM(study_time)         AS total_study_time,
              SUM(questions_answered) AS total_questions,
              SUM(correct_answers)    AS total_correct,
              COUNT(*)                AS study_sessions,
              (SUM(study_time)*0.3 + SUM(questions_answered)*0.4 + SUM(correct_answers)*0.3) AS progress_score
       FROM learning_progress
       GROUP BY user_id
       ORDER BY progress_score DESC`
    )
    await this.lbRepo.deleteRecordsForDate(lb.id, today)
    for (let i = 0; i < rows.length; i++) {
      const r: any = rows[i]
      await this.lbRepo.insertRank(lb.id, r.user_id, r.progress_score, i + 1, today, {
        total_study_time: r.total_study_time,
        total_questions: r.total_questions,
        total_correct: r.total_correct,
        study_sessions: r.study_sessions,
      })
    }
  }
}
