import { Response } from 'express'
import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool } from '@config/database.js'
import { AuthRequest } from 'types/auth.js'
import { ApiResponse } from 'types/response.js'

// ❌ 这里不要 extends RowDataPacket（它不是直接来自 mysql2 的行）
interface IQuestion {
  id: number
  content: string
  type: string
  difficulty: string
  knowledge_points: any
  created_at: Date
  updated_at: Date
}

// ❌ 同理，这里也不要 extends RowDataPacket
interface IFavorite {
  id: number
  user_id: number
  question_id: number
  created_at: Date
  question: IQuestion
}

type FavoriteListData = {
  favorites: IFavorite[]
}

// ✅ 这是 SQL 直接查出来的行，才需要 RowDataPacket
interface FavoriteRow extends RowDataPacket {
  id: number
  user_id: number
  question_id: number
  created_at: Date
  question_id_detail: number
  content: string
  question_type: string
  difficulty: string
  knowledge_points: any
  question_created_at: Date
  question_updated_at: Date
}

interface FavoriteOnlyRow extends RowDataPacket {
  id: number
  user_id: number
  question_id: number
  created_at: Date
}

export class FavoriteController {
  static async list(req: AuthRequest, res: Response<ApiResponse<FavoriteListData>>) {
    try {
      const userId = req.user?.id

      const [rows] = await pool.query<FavoriteRow[]>(
        `SELECT 
          f.id, f.user_id, f.question_id, f.created_at,
          q.id AS question_id_detail,
          q.content,
          q.question_type,
          q.difficulty,
          q.knowledge_points,
          q.created_at AS question_created_at,
          q.updated_at AS question_updated_at
        FROM favorites f
        JOIN questions q ON f.question_id = q.id
        WHERE f.user_id = ?
        ORDER BY f.created_at DESC`,
        [userId]
      )

      const favorites: IFavorite[] = rows.map(row => ({
        id: row.id,
        user_id: row.user_id,
        question_id: row.question_id,
        created_at: row.created_at,
        question: {
          id: row.question_id_detail,
          content: row.content,
          type: row.question_type,
          difficulty: row.difficulty,
          knowledge_points: row.knowledge_points,
          created_at: row.question_created_at,
          updated_at: row.question_updated_at,
        },
      }))

      return res.json({ success: true, data: { favorites } })
    } catch (error) {
      console.error('获取收藏列表错误:', error)
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '获取收藏列表失败',
      })
    }
  }

  static async add(req: AuthRequest, res: Response<ApiResponse<{ id: number }>>) {
    try {
      const userId = req.user?.id
      const { question_id } = req.body
      if (!question_id) {
        return res.status(400).json({ success: false, error: '缺少必要参数' })
      }

      const [existingFavorites] = await pool.query<FavoriteOnlyRow[]>(
        'SELECT id, user_id, question_id, created_at FROM favorites WHERE user_id = ? AND question_id = ?',
        [userId, question_id]
      )

      if (existingFavorites.length > 0) {
        return res.json({ success: true, data: { id: existingFavorites[0].id } })
      }

      const [result] = await pool.query<ResultSetHeader>('INSERT INTO favorites (user_id, question_id) VALUES (?, ?)', [
        userId,
        question_id,
      ])

      return res.status(201).json({ success: true, data: { id: result.insertId } })
    } catch (error) {
      console.error('添加收藏错误:', error)
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '添加收藏失败',
      })
    }
  }

  static async remove(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      const questionId = req.params.questionId
      await pool.query('DELETE FROM favorites WHERE user_id = ? AND question_id = ?', [userId, questionId])
      return res.json({ success: true, data: null })
    } catch (error) {
      console.error('删除收藏错误:', error)
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '删除收藏失败',
      })
    }
  }
}
