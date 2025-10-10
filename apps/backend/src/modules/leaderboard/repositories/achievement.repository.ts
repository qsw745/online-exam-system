import { pool } from '@/config/database.js'
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'

type Queryable = { query<T = any>(sql: string, params?: any[]): Promise<[T, any]> }
const asQ = (x: any): Queryable => x as Queryable

export class AchievementRepository {
  async listByUser(userId: number) {
    const [rows] = await asQ(pool).query<RowDataPacket[]>(
      `SELECT la.*, l.name AS leaderboard_name, c.title AS competition_title
       FROM leaderboard_achievements la
       LEFT JOIN leaderboards l ON l.id = la.leaderboard_id
       LEFT JOIN competitions c ON c.id = la.competition_id
       WHERE la.user_id=?
       ORDER BY la.achieved_at DESC`,
      [userId]
    )
    return rows
  }

  async exists(userId: number, type: string, leaderboardId?: number | null, competitionId?: number | null) {
    const [rows] = await asQ(pool).query<RowDataPacket[]>(
      `SELECT id FROM leaderboard_achievements 
       WHERE user_id=? AND achievement_type=? AND leaderboard_id <=> ? AND competition_id <=> ? LIMIT 1`,
      [userId, type, leaderboardId ?? null, competitionId ?? null]
    )
    return rows.length > 0
  }

  async insert(
    userId: number,
    type: string,
    name: string,
    description: string,
    leaderboardId?: number | null,
    competitionId?: number | null,
    metadata?: any
  ) {
    await asQ(pool).query<ResultSetHeader>(
      `INSERT INTO leaderboard_achievements
       (user_id, achievement_type, achievement_name, achievement_description, leaderboard_id, competition_id, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, type, name, description, leaderboardId ?? null, competitionId ?? null, JSON.stringify(metadata ?? {})]
    )
  }
}
