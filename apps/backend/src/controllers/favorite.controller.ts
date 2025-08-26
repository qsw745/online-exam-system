import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { pool } from '../config/database.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { ApiResponse } from '../types/response.js';

interface IQuestion extends RowDataPacket {
  id: string;
  content: string;
  type: string;
  difficulty: string;
  knowledge_points: any;
  created_at: Date;
  updated_at: Date;
}

interface IFavorite extends RowDataPacket {
  id: number;
  user_id: number;
  question_id: number;
  created_at: Date;
  question: IQuestion;
}

type FavoriteListData = {
  favorites: IFavorite[];
};

export class FavoriteController {
  static async list(req: AuthRequest, res: Response<ApiResponse<FavoriteListData>>) {
    try {
      const userId = req.user?.id;
      
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT 
          f.id, f.user_id, f.question_id, f.created_at,
          q.id as question_id_detail, q.content, q.question_type, 
          q.knowledge_points, q.created_at as question_created_at, q.updated_at as question_updated_at
        FROM favorites f
        JOIN questions q ON f.question_id = q.id
        WHERE f.user_id = ?
        ORDER BY f.created_at DESC`,
        [userId]
      );
      
      // 转换数据结构
      const favorites: IFavorite[] = rows.map(row => ({
        id: row.id,
        user_id: row.user_id,
        question_id: row.question_id,
        created_at: row.created_at,
        question: {
          id: row.question_id_detail,
          content: row.content,
          type: row.question_type,
          knowledge_point: row.knowledge_points, // 映射为前端期望的字段名
          created_at: row.question_created_at,
          updated_at: row.question_updated_at
        }
      }));
      
      const response: ApiResponse<FavoriteListData> = {
        success: true,
        data: {
          favorites
        }
      };
      return res.json(response);
    } catch (error) {
      console.error('获取收藏列表错误:', error);
      const response: ApiResponse<FavoriteListData> = {
        success: false,
        error: error instanceof Error ? error.message : '获取收藏列表失败'
      };
      return res.status(500).json(response);
    }
  }

  static async add(req: AuthRequest, res: Response<ApiResponse<{ id: number }>>) {
    try {
      const userId = req.user?.id;
      const { question_id } = req.body;
      
      if (!question_id) {
        return res.status(400).json({
          success: false,
          error: '缺少必要参数'
        });
      }
      
      // 检查是否已经收藏
      const [existingFavorites] = await pool.query<IFavorite[]>(
        'SELECT * FROM favorites WHERE user_id = ? AND question_id = ?',
        [userId, question_id]
      );
      
      if (existingFavorites.length > 0) {
        return res.json({
          success: true,
          data: {
            id: existingFavorites[0].id
          }
        });
      }
      
      // 添加收藏
      const [result] = await pool.query<ResultSetHeader>(
        'INSERT INTO favorites (user_id, question_id) VALUES (?, ?)',
        [userId, question_id]
      );
      
      const response: ApiResponse<{ id: number }> = {
        success: true,
        data: {
          id: result.insertId
        }
      };
      return res.status(201).json(response);
    } catch (error) {
      console.error('添加收藏错误:', error);
      const response: ApiResponse<{ id: number }> = {
        success: false,
        error: error instanceof Error ? error.message : '添加收藏失败'
      };
      return res.status(500).json(response);
    }
  }

  static async remove(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id;
      const questionId = req.params.questionId;
      
      await pool.query(
        'DELETE FROM favorites WHERE user_id = ? AND question_id = ?',
        [userId, questionId]
      );
      
      const response: ApiResponse<null> = {
        success: true
      };
      return res.json(response);
    } catch (error) {
      console.error('删除收藏错误:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : '删除收藏失败'
      };
      return res.status(500).json(response);
    }
  }
}