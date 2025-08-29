import { Response } from 'express'
import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool } from '../config/database.js'
import { LoggerService } from '../services/logger.service.js'
import { AuthRequest } from '../types/auth.js'
import { ApiResponse } from '../types/response.js'

interface IExam extends RowDataPacket {
  id: number
  title: string
  description: string
  duration: number
  start_time: Date
  end_time: Date
  total_score: number
  passing_score: number
  created_by: number
  status: 'draft' | 'published' | 'closed'
  created_at: Date
  updated_at: Date
}

type ExamListData = {
  exams: IExam[]
  total: number
  page: number
  limit: number
}

type ExamDetailData = {
  exam: IExam
  questions: Array<{
    id: number
    title: string
    content: string
    type: string
    score: number
    options?: string
  }>
}
// 先定义查询返回的行类型
interface QuestionRow extends RowDataPacket {
  id: number
  title: string
  content: string
  type: string // 注意：SQL 里用了  q.question_type as type
  score: number
  options?: string | null
}
export class ExamController {
  static async list(req: AuthRequest, res: Response<ApiResponse<ExamListData>>) {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 10
      const status = req.query.status as IExam['status']
      const search = req.query.search as string

      const offset = (page - 1) * limit
      const conditions: string[] = []
      const values: any[] = []

      if (status) {
        conditions.push('status = ?')
        values.push(status)
      }

      if (search) {
        conditions.push('(title LIKE ? OR description LIKE ?)')
        values.push(`%${search}%`, `%${search}%`)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const [exams] = await pool.query<IExam[]>(
        `SELECT * FROM exams ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...values, limit, offset]
      )

      const [totalRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM exams ${whereClause}`,
        values
      )

      const successResponse: ApiResponse<ExamListData> = {
        success: true,
        data: {
          exams,
          total: totalRows[0].total,
          page,
          limit,
        },
      }
      return res.json(successResponse)
    } catch (error) {
      console.error('获取考试列表错误:', error)
      const errorResponse: ApiResponse<ExamListData> = {
        success: false,
        error: error instanceof Error ? error.message : '获取考试列表失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  static async getById(req: AuthRequest, res: Response<ApiResponse<ExamDetailData>>) {
    try {
      const taskId = parseInt(req.params.id)

      if (isNaN(taskId)) {
        const errorResponse: ApiResponse<ExamDetailData> = {
          success: false,
          error: '无效的任务ID',
        }
        return res.status(400).json(errorResponse)
      }

      // 首先通过taskId查询tasks表获取exam_id
      const [tasks] = await pool.query<RowDataPacket[]>('SELECT exam_id FROM tasks WHERE id = ?', [taskId])

      if (tasks.length === 0) {
        const errorResponse: ApiResponse<ExamDetailData> = {
          success: false,
          error: '任务不存在',
        }
        return res.status(404).json(errorResponse)
      }

      const examId = tasks[0].exam_id
      const [exams] = await pool.query<IExam[]>('SELECT * FROM exams WHERE id = ?', [examId])

      if (exams.length === 0) {
        const errorResponse: ApiResponse<ExamDetailData> = {
          success: false,
          error: '考试不存在',
        }
        return res.status(404).json(errorResponse)
      }

      // 把 RowDataPacket[] 换成 QuestionRow[]
      const [questionRows] = await pool.query<QuestionRow[]>(
        `SELECT q.id, q.title, q.content, q.question_type as type, eq.score, q.options
   FROM questions q
   JOIN exam_questions eq ON q.id = eq.question_id
   WHERE eq.exam_id = ?
   ORDER BY eq.question_order`,
        [examId]
      )
      // 明确映射为 ExamDetailData 需要的结构（顺带把 null -> undefined）
      const questions = questionRows.map(q => ({
        id: q.id,
        title: q.title,
        content: q.content,
        type: q.type,
        score: q.score,
        options: q.options ?? undefined,
      }))
      const successResponse: ApiResponse<ExamDetailData> = {
        success: true,
        data: {
          exam: exams[0],
          questions, // ✅ 不再是 RowDataPacket[]
        },
      }
      return res.json(successResponse)
    } catch (error) {
      console.error('获取考试详情错误:', error)
      const errorResponse: ApiResponse<ExamDetailData> = {
        success: false,
        error: error instanceof Error ? error.message : '获取考试详情失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  static async create(req: AuthRequest, res: Response<ApiResponse<IExam>>) {
    try {
      const userId = req.user?.id
      const { title, description, duration, start_time, end_time, total_score, passing_score, questions } = req.body

      if (!userId) {
        const errorResponse: ApiResponse<IExam> = {
          success: false,
          error: '未授权访问',
        }
        return res.status(401).json(errorResponse)
      }

      if (!title || !duration || !total_score || !passing_score) {
        const errorResponse: ApiResponse<IExam> = {
          success: false,
          error: '缺少必要的考试信息',
        }
        return res.status(400).json(errorResponse)
      }

      const connection = await pool.getConnection()
      try {
        await connection.beginTransaction()

        const [result] = await connection.query<ResultSetHeader>(
          `INSERT INTO exams (
            title, description, duration, start_time, end_time,
            total_score, passing_score, created_by, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
          [title, description, duration, start_time, end_time, total_score, passing_score, userId]
        )

        if (questions && questions.length > 0) {
          const examId = result.insertId
          const questionValues = questions.map((q: any, index: number) => [examId, q.question_id, index + 1])

          await connection.query('INSERT INTO exam_questions (exam_id, question_id, question_order) VALUES ?', [
            questionValues,
          ])
        }

        await connection.commit()

        const [exam] = await connection.query<IExam[]>('SELECT * FROM exams WHERE id = ?', [result.insertId])

        // 记录考试创建操作日志
        await LoggerService.logUserAction({
          userId: req.user?.id || 0,
          username: req.user?.username,
          action: 'create_exam',
          resourceType: 'exam',
          resourceId: Number(result.insertId),
          details: { title, duration, questionCount: questions?.length || 0 },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        })

        const successResponse: ApiResponse<IExam> = {
          success: true,
          data: exam[0],
        }
        return res.status(201).json(successResponse)
      } catch (error) {
        await connection.rollback()
        throw error
      } finally {
        connection.release()
      }
    } catch (error) {
      console.error('创建考试错误:', error)
      const errorResponse: ApiResponse<IExam> = {
        success: false,
        error: error instanceof Error ? error.message : '创建考试失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  static async update(req: AuthRequest, res: Response<ApiResponse<IExam>>) {
    try {
      const userId = req.user?.id
      const examId = parseInt(req.params.id)
      const { title, description, duration, start_time, end_time, total_score, passing_score, status, questions } =
        req.body

      if (!userId) {
        const errorResponse: ApiResponse<IExam> = {
          success: false,
          error: '未授权访问',
        }
        return res.status(401).json(errorResponse)
      }

      if (isNaN(examId)) {
        const errorResponse: ApiResponse<IExam> = {
          success: false,
          error: '无效的考试ID',
        }
        return res.status(400).json(errorResponse)
      }

      const connection = await pool.getConnection()
      try {
        await connection.beginTransaction()

        const [existingExam] = await connection.query<IExam[]>('SELECT * FROM exams WHERE id = ? AND created_by = ?', [
          examId,
          userId,
        ])

        if (existingExam.length === 0) {
          const errorResponse: ApiResponse<IExam> = {
            success: false,
            error: '考试不存在或无权限修改',
          }
          return res.status(404).json(errorResponse)
        }

        await connection.query(
          `UPDATE exams SET
            title = ?,
            description = ?,
            duration = ?,
            start_time = ?,
            end_time = ?,
            total_score = ?,
            passing_score = ?,
            status = ?,
            updated_at = NOW()
          WHERE id = ? AND created_by = ?`,
          [title, description, duration, start_time, end_time, total_score, passing_score, status, examId, userId]
        )

        if (questions) {
          await connection.query('DELETE FROM exam_questions WHERE exam_id = ?', [examId])

          if (questions.length > 0) {
            const questionValues = questions.map((q: any, index: number) => [examId, q.question_id, index + 1])

            await connection.query('INSERT INTO exam_questions (exam_id, question_id, question_order) VALUES ?', [
              questionValues,
            ])
          }
        }

        await connection.commit()

        const [updatedExam] = await connection.query<IExam[]>('SELECT * FROM exams WHERE id = ?', [examId])

        // 记录考试更新操作日志
        await LoggerService.logUserAction({
          userId: req.user?.id || 0,
          username: req.user?.username,
          action: 'update_exam',
          resourceType: 'exam',
          resourceId: Number(examId),
          details: { title, status, questionCount: questions?.length },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        })

        const successResponse: ApiResponse<IExam> = {
          success: true,
          data: updatedExam[0],
        }
        return res.json(successResponse)
      } catch (error) {
        await connection.rollback()
        throw error
      } finally {
        connection.release()
      }
    } catch (error) {
      console.error('更新考试错误:', error)
      const errorResponse: ApiResponse<IExam> = {
        success: false,
        error: error instanceof Error ? error.message : '更新考试失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  static async delete(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      const examId = parseInt(req.params.id)

      if (!userId) {
        const errorResponse: ApiResponse<null> = {
          success: false,
          error: '未授权访问',
        }
        return res.status(401).json(errorResponse)
      }

      if (isNaN(examId)) {
        const errorResponse: ApiResponse<null> = {
          success: false,
          error: '无效的考试ID',
        }
        return res.status(400).json(errorResponse)
      }

      const connection = await pool.getConnection()
      try {
        await connection.beginTransaction()

        const [existingExam] = await connection.query<IExam[]>('SELECT * FROM exams WHERE id = ? AND created_by = ?', [
          examId,
          userId,
        ])

        if (existingExam.length === 0) {
          const errorResponse: ApiResponse<null> = {
            success: false,
            error: '考试不存在或无权限删除',
          }
          return res.status(404).json(errorResponse)
        }

        await connection.query('DELETE FROM exam_questions WHERE exam_id = ?', [examId])
        await connection.query('DELETE FROM exams WHERE id = ?', [examId])

        await connection.commit()

        // 记录考试删除操作日志
        await LoggerService.logUserAction({
          userId: req.user?.id || 0,
          username: req.user?.username,
          action: 'delete_exam',
          resourceType: 'exam',
          resourceId: Number(examId),
          details: { examTitle: existingExam[0].title },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        })

        const successResponse: ApiResponse<null> = {
          success: true,
          data: null,
        }
        return res.json(successResponse)
      } catch (error) {
        await connection.rollback()
        throw error
      } finally {
        connection.release()
      }
    } catch (error) {
      console.error('删除考试错误:', error)
      const errorResponse: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : '删除考试失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  static async start(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      const examId = parseInt(req.params.id)

      if (!userId) {
        const errorResponse: ApiResponse<null> = {
          success: false,
          error: '未授权访问',
        }
        return res.status(401).json(errorResponse)
      }

      if (isNaN(examId)) {
        const errorResponse: ApiResponse<null> = {
          success: false,
          error: '无效的考试ID',
        }
        return res.status(400).json(errorResponse)
      }

      const [exams] = await pool.query<IExam[]>('SELECT * FROM exams WHERE id = ? AND status = "published"', [examId])

      if (exams.length === 0) {
        const errorResponse: ApiResponse<null> = {
          success: false,
          error: '考试不存在或未发布',
        }
        return res.status(404).json(errorResponse)
      }

      const exam = exams[0]
      const now = new Date()

      if (exam.start_time && now < exam.start_time) {
        const errorResponse: ApiResponse<null> = {
          success: false,
          error: '考试还未开始',
        }
        return res.status(400).json(errorResponse)
      }

      if (exam.end_time && now > exam.end_time) {
        const errorResponse: ApiResponse<null> = {
          success: false,
          error: '考试已结束',
        }
        return res.status(400).json(errorResponse)
      }

      const [existingResults] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM exam_results WHERE exam_id = ? AND user_id = ? AND status != "submitted"',
        [examId, userId]
      )

      if (existingResults.length > 0) {
        const errorResponse: ApiResponse<null> = {
          success: false,
          error: '您已经开始了这个考试',
        }
        return res.status(400).json(errorResponse)
      }

      await pool.query(
        'INSERT INTO exam_results (exam_id, user_id, start_time, status) VALUES (?, ?, NOW(), "in_progress")',
        [examId, userId]
      )

      const successResponse: ApiResponse<null> = {
        success: true,
        data: null,
      }
      return res.json(successResponse)
    } catch (error) {
      console.error('开始考试错误:', error)
      const errorResponse: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : '开始考试失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  static async submit(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      const examId = parseInt(req.params.id)
      const { answers } = req.body

      if (!userId) {
        const errorResponse: ApiResponse<null> = {
          success: false,
          error: '未授权访问',
        }
        return res.status(401).json(errorResponse)
      }

      if (isNaN(examId)) {
        const errorResponse: ApiResponse<null> = {
          success: false,
          error: '无效的考试ID',
        }
        return res.status(400).json(errorResponse)
      }

      const connection = await pool.getConnection()
      try {
        await connection.beginTransaction()

        const [results] = await connection.query<RowDataPacket[]>(
          'SELECT * FROM exam_results WHERE exam_id = ? AND user_id = ? AND status = "in_progress"',
          [examId, userId]
        )

        if (results.length === 0) {
          const errorResponse: ApiResponse<null> = {
            success: false,
            error: '未找到进行中的考试',
          }
          return res.status(404).json(errorResponse)
        }

        const resultId = results[0].id
        const [questions] = await connection.query<RowDataPacket[]>(
          `SELECT q.id, q.answer, q.score
           FROM questions q
           JOIN exam_questions eq ON q.id = eq.question_id
           WHERE eq.exam_id = ?`,
          [examId]
        )

        let totalScore = 0
        for (const question of questions) {
          const userAnswer = answers[question.id]
          if (userAnswer === question.answer) {
            totalScore += question.score
          }

          await connection.query(
            'INSERT INTO answer_records (exam_result_id, question_id, user_answer, is_correct) VALUES (?, ?, ?, ?)',
            [resultId, question.id, userAnswer, userAnswer === question.answer]
          )
        }

        await connection.query(
          'UPDATE exam_results SET score = ?, submit_time = NOW(), status = "submitted", answers = ? WHERE id = ?',
          [totalScore, JSON.stringify(answers), resultId]
        )

        await connection.commit()

        // 自动收集错题到错题本
        try {
          const { WrongQuestionController } = await import('./wrong-question.controller.js')
          const wrongQuestionReq = {
            ...req,
            body: { exam_result_id: resultId },
          }
          // 异步调用，不影响考试提交的响应
          setImmediate(() => {
            WrongQuestionController.autoCollectWrongQuestions(
              wrongQuestionReq as AuthRequest,
              {
                json: () => {},
                status: () => ({ json: () => {} }),
              } as any
            ).catch(error => {
              console.error('自动收集错题失败:', error)
            })
          })
        } catch (error) {
          console.error('导入错题控制器失败:', error)
        }

        // 异步记录学习进度，不影响考试提交响应
        setImmediate(async () => {
          try {
            const { learningProgressController } = await import('./learning-progress.controller.js')
            const totalQuestions = questions.length
            const correctCount = questions.filter(q => answers[q.id] === q.answer).length
            const studyTime = Math.floor(Math.random() * 60) + 30 // 模拟学习时长30-90分钟
            learningProgressController
              .recordProgress(
                {
                  user: req.user,
                  body: {
                    studyTime: studyTime,
                    questionsAnswered: totalQuestions,
                    correctAnswers: correctCount,
                    studyContent: `考试：${examId}`,
                  },
                } as any,
                {
                  json: () => {},
                  status: () => ({ json: () => {} }),
                } as any
              )
              .catch(error => {
                console.error('记录学习进度失败:', error)
              })
          } catch (error) {
            console.error('导入学习进度控制器失败:', error)
          }
        })

        // 异步更新排行榜数据，不影响考试提交响应
        setImmediate(async () => {
          try {
            const { LeaderboardService } = await import('../services/leaderboard.service.js')
            const leaderboardService = new LeaderboardService()
            const totalQuestions = questions.length
            const correctCount = questions.filter(q => answers[q.id] === q.answer).length
            const accuracy = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0

            // 更新分数排行榜
            await leaderboardService.updateLeaderboardRanking(1, userId!, totalScore)

            // 更新正确率排行榜
            await leaderboardService.updateLeaderboardRanking(3, userId!, accuracy)

            // 检查并颁发成就
            await leaderboardService.checkAndAwardRankingAchievements(userId!)
          } catch (error) {
            console.error('更新排行榜失败:', error)
          }
        })

        const successResponse: ApiResponse<null> = {
          success: true,
          data: null,
        }
        return res.json(successResponse)
      } catch (error) {
        await connection.rollback()
        throw error
      } finally {
        connection.release()
      }
    } catch (error) {
      console.error('提交考试错误:', error)
      const errorResponse: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : '提交考试失败',
      }
      return res.status(500).json(errorResponse)
    }
  }
}
