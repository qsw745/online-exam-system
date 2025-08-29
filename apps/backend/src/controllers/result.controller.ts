import { Response } from 'express'
import { RowDataPacket } from 'mysql2'
import { pool } from '../config/database.js'
import { AuthRequest } from '../types/auth.js'
import { ApiResponse } from '../types/response.js'

interface IResult extends RowDataPacket {
  id: number
  paper_id: number
  paper_title: string
  score: number
  total_score: number
  answers?: string
  start_time: Date
  end_time: Date
  status: 'pending' | 'in_progress' | 'completed'
  created_at: Date
  updated_at: Date
}

type ResultData = IResult

type ResultListData = {
  results: IResult[]
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export class ResultController {
  static async list(req: AuthRequest, res: Response<ApiResponse<ResultListData>>) {
    try {
      const userId = req.user?.id
      const userRole = req.user?.role
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 10
      const search = (req.query.search as string) || ''
      const status = (req.query.status as string) || ''
      const sort = (req.query.sort as string) || 'created_at'
      const paperId = (req.query.paper_id as string) || ''
      const includeStudentInfo = req.query.include_student_info === 'true'

      if (!userId) {
        const errorResponse: ApiResponse<ResultListData> = {
          success: false,
          error: '未授权',
        }
        return res.status(401).json(errorResponse)
      }

      const offset = (page - 1) * limit
      const allowedSortFields = ['created_at', 'score', 'start_time', 'end_time']
      const sortField = allowedSortFields.includes(sort) ? sort : 'created_at'

      // 构建查询条件
      let whereClause = ''
      const queryParams: any[] = []

      // 如果是学生，只能查看自己的成绩
      if (userRole === 'student') {
        whereClause = 'WHERE r.user_id = ?'
        queryParams.push(userId)
      } else {
        // 教师和管理员可以查看所有成绩
        whereClause = 'WHERE 1=1'
      }

      if (search) {
        if (includeStudentInfo) {
          whereClause += ' AND (p.title LIKE ? OR u.nickname LIKE ? OR u.email LIKE ?)'
          queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`)
        } else {
          whereClause += ' AND p.title LIKE ?'
          queryParams.push(`%${search}%`)
        }
      }

      if (status) {
        whereClause += ' AND r.status = ?'
        queryParams.push(status)
      }

      if (paperId) {
        whereClause += ' AND r.paper_id = ?'
        queryParams.push(paperId)
      }

      // 构建JOIN子句
      let joinClause = 'JOIN papers p ON r.paper_id = p.id'
      if (includeStudentInfo) {
        joinClause += ' JOIN users u ON r.user_id = u.id'
      }

      // 获取总数
      const [countResult] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM exam_results r
         ${joinClause}
         ${whereClause}`,
        queryParams
      )
      const total = countResult[0].total

      // 构建SELECT字段
      let selectFields = `
        r.id,
        r.user_id,
        r.paper_id,
        p.title as paper_title,
        r.score,
        p.total_score,
        ROUND((r.score / p.total_score * 100), 1) as percentage,
        r.start_time,
        r.submit_time as end_time,
        TIMESTAMPDIFF(SECOND, r.start_time, r.submit_time) as duration,
        r.status,
        r.created_at,
        r.updated_at`

      if (includeStudentInfo) {
        selectFields += `,
        u.nickname as student_name,
        u.email as student_email`
      }

      // 获取分页数据
      const [results] = await pool.query<IResult[]>(
        `SELECT ${selectFields}
        FROM exam_results r
        ${joinClause}
        ${whereClause}
        ORDER BY r.${sortField} DESC
        LIMIT ? OFFSET ?`,
        [...queryParams, limit, offset]
      )

      const successResponse: ApiResponse<ResultListData> = {
        success: true,
        data: {
          results,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      }
      return res.json(successResponse)
    } catch (error) {
      console.error('获取考试结果列表错误:', error)
      const errorResponse: ApiResponse<ResultListData> = {
        success: false,
        error: error instanceof Error ? error.message : '获取考试结果列表失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  static async getById(req: AuthRequest, res: Response<ApiResponse<ResultData>>) {
    try {
      const userId = req.user?.id
      const resultId = req.params.id

      if (!userId) {
        const errorResponse: ApiResponse<ResultData> = {
          success: false,
          error: '未授权',
        }
        return res.status(401).json(errorResponse)
      }

      const [results] = await pool.query<IResult[]>(
        `SELECT 
          r.id,
          r.paper_id,
          p.title as paper_title,
          r.score,
          p.total_score,
          r.answers,
          r.start_time,
          r.submit_time as end_time,
          r.status,
          r.created_at,
          r.updated_at
        FROM exam_results r
        JOIN papers p ON r.paper_id = p.id
        WHERE r.id = ? AND r.user_id = ?`,
        [resultId, userId]
      )

      if (!results[0]) {
        const errorResponse: ApiResponse<ResultData> = {
          success: false,
          error: '考试结果不存在',
        }
        return res.status(404).json(errorResponse)
      }

      const successResponse: ApiResponse<ResultData> = {
        success: true,
        data: results[0],
      }
      return res.json(successResponse)
    } catch (error) {
      console.error('获取考试结果详情错误:', error)
      const errorResponse: ApiResponse<ResultData> = {
        success: false,
        error: error instanceof Error ? error.message : '获取考试结果详情失败',
      }
      return res.status(500).json(errorResponse)
    }
  }
}
