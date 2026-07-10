import { pool } from '@/config/database'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'

export type FaceCredentialSource = 'self' | 'admin'

export type FaceCredentialRow = {
  id: number
  user_id: number
  model: string
  dim: number
  embedding: number[]
  source: FaceCredentialSource
  created_by: number | null
  consent_at: Date | null
  consent_version: string | null
  created_at: Date
  updated_at: Date
}

export type FaceCredentialInsert = {
  userId: number
  model: string
  dim: number
  embedding: number[]
  source: FaceCredentialSource
  createdBy: number | null
  consentVersion: string | null
}

export type FaceCredentialWithUser = {
  userId: number
  email: string
  username: string | null
  nickname: string | null
  role: string | null
  embedding: number[]
}

// JSON 列在不同 mysql2 配置下可能回传字符串或已解析数组，这里统一成 number[]
function parseEmbedding(raw: unknown): number[] {
  if (Array.isArray(raw)) return raw as number[]
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

const SELECT_COLUMNS = `id, user_id, model, dim, embedding, source, created_by, consent_at, consent_version, created_at, updated_at`

export class FaceCredentialRepository {
  static async listByUser(userId: number): Promise<FaceCredentialRow[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ${SELECT_COLUMNS} FROM face_credentials WHERE user_id=? ORDER BY id DESC`,
      [userId]
    )
    return (rows as any[]).map(r => ({ ...r, embedding: parseEmbedding(r.embedding) })) as FaceCredentialRow[]
  }

  // 1:N 识别用：取全部凭据（含所属用户邮箱），在内存里做余弦比对
  static async listAllWithUser(): Promise<FaceCredentialWithUser[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT fc.user_id, u.email, u.username, u.nickname, u.role, fc.embedding
         FROM face_credentials fc
         JOIN users u ON u.id = fc.user_id
        WHERE u.email IS NOT NULL AND u.email <> ''`
    )
    return (rows as any[]).map(r => ({
      userId: Number(r.user_id),
      email: String(r.email),
      username: r.username ? String(r.username) : null,
      nickname: r.nickname ? String(r.nickname) : null,
      role: r.role ? String(r.role) : null,
      embedding: parseEmbedding(r.embedding),
    }))
  }

  static async countByUser(userId: number): Promise<number> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM face_credentials WHERE user_id=?`,
      [userId]
    )
    return Number((rows as any)[0]?.c || 0)
  }

  static async insert(input: FaceCredentialInsert): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO face_credentials
        (user_id, model, dim, embedding, source, created_by, consent_at, consent_version)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)`,
      [
        input.userId,
        input.model,
        input.dim,
        JSON.stringify(input.embedding),
        input.source,
        input.createdBy,
        input.consentVersion,
      ]
    )
    return result.insertId
  }

  static async deleteByUser(userId: number): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      `DELETE FROM face_credentials WHERE user_id=?`,
      [userId]
    )
    return result.affectedRows
  }

  // 保留该用户最新的 keep 条，淘汰更旧的样本
  static async pruneOldest(userId: number, keep: number): Promise<void> {
    await pool.query(
      `DELETE FROM face_credentials
       WHERE user_id=? AND id NOT IN (
         SELECT id FROM (
           SELECT id FROM face_credentials WHERE user_id=? ORDER BY id DESC LIMIT ?
         ) AS keep_ids
       )`,
      [userId, userId, keep]
    )
  }
}
