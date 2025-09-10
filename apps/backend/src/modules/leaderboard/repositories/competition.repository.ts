import { pool } from '@/config/database.js'
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { Competition } from '../domain/leaderboard.types.js'

export class CompetitionRepository {
  async list(filter: { status?: string; type?: string }) {
    const p: any[] = []
    let sql = `
      SELECT c.*, COUNT(cp.id) AS participant_count
      FROM competitions c
      LEFT JOIN competition_participants cp ON cp.competition_id = c.id
      WHERE 1=1`
    if (filter.status && filter.status !== 'all') {
      sql += ' AND c.status=?'
      p.push(filter.status)
    }
    if (filter.type && filter.type !== 'all') {
      sql += ' AND c.type=?'
      p.push(filter.type)
    }
    sql += ' GROUP BY c.id ORDER BY c.created_at DESC'
    const [rows] = await pool.query<Competition[]>(sql, p)
    return rows
  }

  async findOpenForRegistration(id: number) {
    const [rows] = await pool.query<Competition[]>(
      `SELECT * FROM competitions WHERE id=? AND status='registration' LIMIT 1`,
      [id]
    )
    return rows[0]
  }

  async existsUserJoined(competitionId: number, userId: number) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM competition_participants WHERE competition_id=? AND user_id=? LIMIT 1`,
      [competitionId, userId]
    )
    return rows.length > 0
  }

  async countParticipants(competitionId: number) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM competition_participants WHERE competition_id=?`,
      [competitionId]
    )
    return Number(rows[0]?.cnt || 0)
  }

  async insertParticipant(competitionId: number, userId: number, teamName: string | null) {
    await pool.query<ResultSetHeader>(
      `INSERT INTO competition_participants (competition_id, user_id, team_name) VALUES (?, ?, ?)`,
      [competitionId, userId, teamName]
    )
  }
}
