import { pool } from '@/config/database'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'

export type AiKnowledgeRow = {
  id: number
  title: string | null
  content: string
  tags: string | null
  source: string | null
  embedding_json: string | null
  created_at: string
  updated_at: string
}

export class AiKnowledgeRepository {
  static async insertChunk(input: {
    title?: string | null
    content: string
    tags?: string | null
    source?: string | null
    embeddingJson?: string | null
  }): Promise<number> {
    const [ret] = await pool.query<ResultSetHeader>(
      `INSERT INTO ai_knowledge_chunks (title, content, tags, source, embedding_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [input.title ?? null, input.content, input.tags ?? null, input.source ?? null, input.embeddingJson ?? null]
    )
    return Number(ret.insertId)
  }

  static async list(limit = 20, offset = 0): Promise<AiKnowledgeRow[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, title, content, tags, source, embedding_json, created_at, updated_at
         FROM ai_knowledge_chunks
        ORDER BY updated_at DESC
        LIMIT ? OFFSET ?`,
      [limit, offset]
    )
    return rows as AiKnowledgeRow[]
  }

  static async searchByKeyword(query: string, limit = 5): Promise<AiKnowledgeRow[]> {
    const q = `%${query}%`
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, title, content, tags, source, embedding_json, created_at, updated_at
         FROM ai_knowledge_chunks
        WHERE title LIKE ? OR content LIKE ? OR tags LIKE ? OR source LIKE ?
        ORDER BY updated_at DESC
        LIMIT ?`,
      [q, q, q, q, limit]
    )
    return rows as AiKnowledgeRow[]
  }

  static async listEmbeddingCandidates(limit = 200): Promise<AiKnowledgeRow[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, title, content, tags, source, embedding_json, created_at, updated_at
         FROM ai_knowledge_chunks
        WHERE embedding_json IS NOT NULL AND embedding_json <> ''
        ORDER BY updated_at DESC
        LIMIT ?`,
      [limit]
    )
    return rows as AiKnowledgeRow[]
  }
}
