import { pool } from '@/config/database.js'
import type { RowDataPacket } from 'mysql2/promise'
import type { Leaderboard, LeaderboardRecord } from '../domain/leaderboard.types.js'

export class LeaderboardRepository {
  async list(params: { category?: string; type?: string; active?: string }) {
    let sql = 'SELECT * FROM leaderboards WHERE 1=1'
    const p: any[] = []
    if (params.category && params.category !== 'all') {
      sql += ' AND category=?'
      p.push(params.category)
    }
    if (params.type && params.type !== 'all') {
      sql += ' AND type=?'
      p.push(params.type)
    }
    if (params.active !== undefined) {
      sql += ' AND is_active=?'
      p.push(String(params.active) === 'true')
    }
    sql += ' ORDER BY created_at DESC'
    const [rows] = await pool.query<Leaderboard[]>(sql, p)
    return rows
  }

  async findById(id: number) {
    const [rows] = await pool.query<Leaderboard[]>('SELECT * FROM leaderboards WHERE id=? LIMIT 1', [id])
    return rows[0]
  }

  async listRecords(leaderboardId: number, limit: number, offset: number) {
    const [rows] = await pool.query<LeaderboardRecord[]>(
      `SELECT lr.*, u.username, u.email
       FROM leaderboard_records lr
       JOIN users u ON u.id = lr.user_id
       WHERE lr.leaderboard_id=?
       ORDER BY lr.rank_position ASC
       LIMIT ? OFFSET ?`,
      [leaderboardId, limit, offset]
    )
    return rows
  }

  async getUserLatestRank(leaderboardId: number, userId: number) {
    const [rows] = await pool.query<LeaderboardRecord[]>(
      `SELECT lr.*, u.username, u.email
       FROM leaderboard_records lr
       JOIN users u ON u.id = lr.user_id
       WHERE lr.leaderboard_id=? AND lr.user_id=?
       ORDER BY lr.record_date DESC
       LIMIT 1`,
      [leaderboardId, userId]
    )
    return rows[0] ?? null
  }

  async countParticipants(leaderboardId: number) {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(DISTINCT user_id) AS total FROM leaderboard_records WHERE leaderboard_id=?',
      [leaderboardId]
    )
    return Number(rows[0]?.total || 0)
  }

  async deleteRecordsForDate(leaderboardId: number, isoDate: string) {
    await pool.query('DELETE FROM leaderboard_records WHERE leaderboard_id=? AND record_date=?', [
      leaderboardId,
      isoDate,
    ])
  }

  async insertRank(leaderboardId: number, userId: number, score: number, rank: number, date: string, extra?: any) {
    await pool.query(
      `INSERT INTO leaderboard_records (leaderboard_id, user_id, score, rank_position, record_date, additional_data)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [leaderboardId, userId, score, rank, date, extra ? JSON.stringify(extra) : null]
    )
  }

  async getUserBestRanks(userId: number) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 
         l.name AS leaderboard_name, l.type, l.category,
         MIN(lr.rank_position) AS best_rank,
         MAX(lr.score) AS best_score,
         MAX(lr.record_date) AS record_date
       FROM leaderboard_records lr
       JOIN leaderboards l ON l.id = lr.leaderboard_id
       WHERE lr.user_id=?
       GROUP BY lr.leaderboard_id
       ORDER BY best_rank ASC`,
      [userId]
    )
    return rows
  }

  async getStats(leaderboardId: number) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 
         COUNT(DISTINCT user_id) AS total_participants,
         AVG(score) AS average_score,
         MAX(score) AS highest_score,
         MIN(score) AS lowest_score,
         COUNT(*)  AS total_records
       FROM leaderboard_records
       WHERE leaderboard_id=?`,
      [leaderboardId]
    )
    return rows[0] || {}
  }
}
