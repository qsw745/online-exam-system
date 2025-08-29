import { Response } from 'express'
import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool } from '../config/database.js'
import { LoggerService } from '../services/logger.service.js'
import { AuthRequest } from '../types/auth.js'
import { ApiResponse } from '../types/response.js'

interface IQuestion extends RowDataPacket {
  id: number
  title: string
  content: string
  question_type: 'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer'
  difficulty: 'easy' | 'medium' | 'hard'
  options: string
  correct_answer: string
  knowledge_points: string
  explanation: string
  exam_id: number | null
  score: number
  created_at: Date
  updated_at: Date
}

type QuestionData = {
  question: IQuestion
}

type QuestionListData = {
  questions: IQuestion[]
  pagination: {
    total: number
    totalPages: number
    currentPage: number
    pageSize: number
  }
}

export class QuestionController {
  static async list(req: AuthRequest, res: Response<ApiResponse<QuestionListData>>) {
    try {
      const question_type = req.query.type as
        | 'single_choice'
        | 'multiple_choice'
        | 'true_false'
        | 'short_answer'
        | undefined
      const difficulty = req.query.difficulty as 'easy' | 'medium' | 'hard' | undefined
      const search = req.query.search as string | undefined
      const page = req.query.page ? parseInt(req.query.page as string) : 1
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10
      const offset = (page - 1) * limit

      const conditions: string[] = []
      const values: any[] = []

      if (question_type) {
        conditions.push('question_type = ?')
        values.push(question_type)
      }

      if (difficulty) {
        conditions.push('difficulty = ?')
        values.push(difficulty)
      }

      if (search) {
        conditions.push('content LIKE ?')
        values.push(`%${search}%`)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const [questions] = await pool.query<IQuestion[]>(
        `SELECT * FROM questions ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...values, limit, offset]
      )

      const [totalRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM questions ${whereClause}`,
        values
      )

      const total = totalRows[0].total
      const totalPages = Math.ceil(total / limit)

      // 解析JSON字段
      const parsedQuestions = questions.map(question => {
        try {
          if (question.options && typeof question.options === 'string') {
            question.options = JSON.parse(question.options)
          }

          // correct_answer 字段存储的是简单字符串（如 "A", "B", "C", "D", "true", "false"），不需要JSON解析
          // 保持原字符串格式即可
        } catch (parseError) {
          console.error(`题目ID ${question.id} 解析字段失败:`, parseError)
        }
        return question
      })

      const response: ApiResponse<QuestionListData> = {
        success: true,
        data: {
          questions: parsedQuestions,
          pagination: {
            total,
            totalPages,
            currentPage: page,
            pageSize: limit,
          },
        },
      }
      return res.json(response)
    } catch (error) {
      console.error('获取问题列表错误:', error)
      const response: ApiResponse<QuestionListData> = {
        success: false,
        error: error instanceof Error ? error.message : '获取问题列表失败',
      }
      return res.status(500).json(response)
    }
  }

  static async getById(req: AuthRequest, res: Response<ApiResponse<QuestionData>>) {
    try {
      const { id } = req.params
      const questionId = parseInt(id)

      if (isNaN(questionId) || questionId <= 0) {
        const response: ApiResponse<QuestionData> = {
          success: false,
          error: '无效的题目ID',
        }
        return res.status(400).json(response)
      }

      const [questions] = await pool.query<IQuestion[]>('SELECT * FROM questions WHERE id = ?', [questionId])

      if (questions.length === 0) {
        const response: ApiResponse<QuestionData> = {
          success: false,
          error: '问题不存在',
        }
        return res.status(404).json(response)
      }

      // 解析JSON字段
      const question = questions[0]
      try {
        if (question.options && typeof question.options === 'string') {
          question.options = JSON.parse(question.options)
        }
        // correct_answer 是简单字符串，不需要JSON解析
        // if (question.correct_answer && typeof question.correct_answer === 'string') {
        //   question.correct_answer = JSON.parse(question.correct_answer);
        // }
      } catch (parseError) {
        console.error('解析JSON字段失败:', parseError)
      }

      const response: ApiResponse<QuestionData> = {
        success: true,
        data: { question },
      }
      return res.json(response)
    } catch (error) {
      console.error('获取问题详情错误:', error)
      const response: ApiResponse<QuestionData> = {
        success: false,
        error: error instanceof Error ? error.message : '获取问题详情失败',
      }
      return res.status(500).json(response)
    }
  }

  static async create(req: AuthRequest, res: Response<ApiResponse<QuestionData>>) {
    try {
      const {
        title,
        content,
        question_type,
        options,
        correct_answer,
        knowledge_points,
        explanation,
        difficulty = 'medium',
        exam_id = null,
        score = 10,
      } = req.body

      // 验证必填字段
      if (!content || !question_type || !correct_answer) {
        const response: ApiResponse<QuestionData> = {
          success: false,
          error: '缺少必填字段：题目内容、题目类型和正确答案',
        }
        return res.status(400).json(response)
      }

      // 验证题目类型
      const validTypes = ['single_choice', 'multiple_choice', 'true_false', 'short_answer']
      if (!validTypes.includes(question_type)) {
        const response: ApiResponse<QuestionData> = {
          success: false,
          error: '无效的题目类型',
        }
        return res.status(400).json(response)
      }

      // 验证难度等级
      const validDifficulties = ['easy', 'medium', 'hard']
      if (!validDifficulties.includes(difficulty)) {
        const response: ApiResponse<QuestionData> = {
          success: false,
          error: '无效的难度等级',
        }
        return res.status(400).json(response)
      }

      // 处理选项数据
      let optionsJson = null
      if (question_type === 'single_choice' || question_type === 'multiple_choice') {
        if (!options || !Array.isArray(options) || options.length === 0) {
          const response: ApiResponse<QuestionData> = {
            success: false,
            error: '选择题必须提供选项',
          }
          return res.status(400).json(response)
        }
        optionsJson = JSON.stringify(options)
      }

      // 处理知识点
      const knowledgePointsJson = knowledge_points ? JSON.stringify(knowledge_points) : '[]'

      // 生成标题（如果未提供）
      const questionTitle = title || (content.length > 50 ? content.substring(0, 50) + '...' : content)

      const [result] = await pool.query<ResultSetHeader>(
        'INSERT INTO questions (title, content, question_type, options, correct_answer, knowledge_points, explanation, difficulty, exam_id, score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          questionTitle,
          content,
          question_type,
          optionsJson,
          correct_answer,
          knowledgePointsJson,
          explanation || '',
          difficulty,
          exam_id,
          score,
        ]
      )

      const [question] = await pool.query<IQuestion[]>('SELECT * FROM questions WHERE id = ?', [result.insertId])

      // 记录题目创建操作日志
      await LoggerService.logUserAction({
        userId: req.user?.id || 0,
        username: req.user?.username,
        action: 'create_question',
        resourceType: 'question',
        resourceId: Number(result.insertId),
        details: { questionType: question_type, title: questionTitle, difficulty },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      })

      const response: ApiResponse<QuestionData> = {
        success: true,
        data: { question: question[0] },
      }
      return res.status(201).json(response)
    } catch (error) {
      console.error('创建问题错误:', error)
      const response: ApiResponse<QuestionData> = {
        success: false,
        error: error instanceof Error ? error.message : '创建问题失败',
      }
      return res.status(500).json(response)
    }
  }

  static async update(req: AuthRequest, res: Response<ApiResponse<QuestionData>>) {
    try {
      const { id } = req.params
      const { title, content, question_type, options, correct_answer } = req.body

      const updates: string[] = []
      const values: any[] = []

      if (title !== undefined) {
        updates.push('title = ?')
        values.push(title)
      }

      if (content !== undefined) {
        updates.push('content = ?')
        values.push(content)
      }

      if (question_type !== undefined) {
        updates.push('question_type = ?')
        values.push(question_type)
      }

      if (options !== undefined) {
        updates.push('options = ?')
        values.push(options)
      }

      if (correct_answer !== undefined) {
        updates.push('correct_answer = ?')
        values.push(correct_answer)
      }

      if (updates.length === 0) {
        const response: ApiResponse<QuestionData> = {
          success: false,
          error: '没有需要更新的字段',
        }
        return res.status(400).json(response)
      }

      values.push(parseInt(id))

      const [result] = await pool.query<ResultSetHeader>(
        `UPDATE questions SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
        values
      )

      if (result.affectedRows === 0) {
        const response: ApiResponse<QuestionData> = {
          success: false,
          error: '问题不存在',
        }
        return res.status(404).json(response)
      }

      const [question] = await pool.query<IQuestion[]>('SELECT * FROM questions WHERE id = ?', [parseInt(id)])

      // 记录题目更新操作日志
      await LoggerService.logUserAction({
        userId: req.user?.id || 0,
        username: req.user?.username,
        action: 'update_question',
        resourceType: 'question',
        resourceId: Number(id),
        details: { updatedFields: updates, questionId: parseInt(id) },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      })

      const response: ApiResponse<QuestionData> = {
        success: true,
        data: { question: question[0] },
      }
      return res.json(response)
    } catch (error) {
      console.error('更新问题错误:', error)
      const response: ApiResponse<QuestionData> = {
        success: false,
        error: error instanceof Error ? error.message : '更新问题失败',
      }
      return res.status(500).json(response)
    }
  }

  static async delete(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const { id } = req.params

      const [result] = await pool.query<ResultSetHeader>('DELETE FROM questions WHERE id = ?', [parseInt(id)])

      if (result.affectedRows === 0) {
        const response: ApiResponse<null> = {
          success: false,
          error: '问题不存在',
        }
        return res.status(404).json(response)
      }

      // 记录题目删除操作日志
      await LoggerService.logUserAction({
        userId: req.user?.id || 0,
        username: req.user?.username,
        action: 'delete_question',
        resourceType: 'question',
        resourceId: Number(id),
        details: { questionId: parseInt(id) },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      })

      const response: ApiResponse<null> = {
        success: true,
        data: null,
      }
      return res.json(response)
    } catch (error) {
      console.error('删除问题错误:', error)
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : '删除问题失败',
      }
      return res.status(500).json(response)
    }
  }

  static async bulkImport(
    req: AuthRequest,
    res: Response<ApiResponse<{ success_count: number; fail_count: number; errors: string[] }>>
  ) {
    try {
      const { questions } = req.body

      if (!questions || !Array.isArray(questions) || questions.length === 0) {
        const response: ApiResponse<{ success_count: number; fail_count: number; errors: string[] }> = {
          success: false,
          error: '请提供有效的题目数据',
        }
        return res.status(400).json(response)
      }

      // 验证题目数量限制
      if (questions.length > 1000) {
        const response: ApiResponse<{ success_count: number; fail_count: number; errors: string[] }> = {
          success: false,
          error: '单次导入题目数量不能超过1000道',
        }
        return res.status(400).json(response)
      }

      let successCount = 0
      let failCount = 0
      const errors: string[] = []
      const validTypes = ['single_choice', 'multiple_choice', 'true_false', 'short_answer']
      const validDifficulties = ['easy', 'medium', 'hard']

      // 批量处理题目
      for (let i = 0; i < questions.length; i++) {
        try {
          const question = questions[i]
          const {
            title,
            content,
            question_type,
            options,
            answer,
            knowledge_points,
            explanation,
            difficulty = 'medium',
            score = 10,
          } = question

          // 验证必填字段
          if (!content || !question_type || !answer) {
            failCount++
            errors.push(`第${i + 1}题：缺少必填字段（题目内容、题目类型或答案）`)
            continue
          }

          // 验证题目类型
          if (!validTypes.includes(question_type)) {
            failCount++
            errors.push(`第${i + 1}题：无效的题目类型 ${question_type}`)
            continue
          }

          // 验证难度等级
          if (!validDifficulties.includes(difficulty)) {
            failCount++
            errors.push(`第${i + 1}题：无效的难度等级 ${difficulty}`)
            continue
          }

          // 处理选项数据
          let optionsJson = null
          if (question_type === 'single_choice' || question_type === 'multiple_choice') {
            if (options && Array.isArray(options) && options.length > 0) {
              // 验证选项格式
              const validOptions = options.every(
                opt => typeof opt === 'object' && typeof opt.content === 'string' && typeof opt.is_correct === 'boolean'
              )
              if (!validOptions) {
                failCount++
                errors.push(`第${i + 1}题：选项格式不正确，应包含content和is_correct字段`)
                continue
              }
              optionsJson = JSON.stringify(options)
            } else {
              failCount++
              errors.push(`第${i + 1}题：选择题必须提供选项`)
              continue
            }
          }

          // 处理知识点
          const knowledgePointsJson = knowledge_points ? JSON.stringify(knowledge_points) : '[]'

          // 检查是否已存在相同的题目（基于内容和类型）
          const [existingQuestions] = await pool.query<RowDataPacket[]>(
            'SELECT id FROM questions WHERE content = ? AND question_type = ?',
            [content, question_type]
          )

          if (existingQuestions.length > 0) {
            failCount++
            errors.push(`第${i + 1}题：题目已存在，跳过导入`)
            continue
          }

          // 生成标题（使用提供的标题或题目内容的前50个字符）
          const questionTitle = title || (content.length > 50 ? content.substring(0, 50) + '...' : content)

          // 插入题目
          await pool.query(
            'INSERT INTO questions (title, content, question_type, options, correct_answer, knowledge_points, explanation, difficulty, exam_id, score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              questionTitle,
              content,
              question_type,
              optionsJson,
              answer,
              knowledgePointsJson,
              explanation || '',
              difficulty,
              null,
              score,
            ]
          )

          successCount++
        } catch (error) {
          failCount++
          const errorMsg = error instanceof Error ? error.message : '未知错误'
          errors.push(`第${i + 1}题导入失败：${errorMsg}`)
        }
      }

      // 记录批量导入操作日志
      await LoggerService.logUserAction({
        userId: req.user?.id || 0,
        username: req.user?.username,
        action: 'bulk_import_questions',
        resourceType: 'question',
        details: {
          totalQuestions: questions.length,
          successCount,
          failCount,
          errorCount: errors.length,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      })

      const response: ApiResponse<{ success_count: number; fail_count: number; errors: string[] }> = {
        success: true,
        data: {
          success_count: successCount,
          fail_count: failCount,
          errors: errors,
        },
      }

      return res.status(200).json(response)
    } catch (error) {
      console.error('批量导入问题错误:', error)
      const response: ApiResponse<{ success_count: number; fail_count: number; errors: string[] }> = {
        success: false,
        error: error instanceof Error ? error.message : '批量导入失败',
      }
      return res.status(500).json(response)
    }
  }

  // 记录练习结果
  static async recordPractice(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      const { question_id, is_correct, answer } = req.body

      if (!userId || isNaN(userId)) {
        const response: ApiResponse<null> = {
          success: false,
          error: '未授权访问或用户ID无效',
        }
        return res.status(401).json(response)
      }

      if (!question_id || is_correct === undefined) {
        const response: ApiResponse<null> = {
          success: false,
          error: '缺少必要参数',
        }
        return res.status(400).json(response)
      }

      const connection = await pool.getConnection()
      try {
        await connection.beginTransaction()

        // 记录练习记录
        await connection.query(
          'INSERT INTO practice_records (user_id, question_id, is_correct, user_answer) VALUES (?, ?, ?, ?)',
          [userId, question_id, is_correct, JSON.stringify(answer)]
        )

        // 如果答错了，更新错题本
        if (!is_correct) {
          const [existing] = await connection.query<RowDataPacket[]>(
            'SELECT * FROM wrong_questions WHERE user_id = ? AND question_id = ?',
            [userId, question_id]
          )

          if (existing.length > 0) {
            // 更新现有错题记录
            await connection.query(
              'UPDATE wrong_questions SET wrong_count = wrong_count + 1, last_practice_time = NOW(), is_mastered = FALSE WHERE user_id = ? AND question_id = ?',
              [userId, question_id]
            )
          } else {
            // 创建新的错题记录
            await connection.query(
              'INSERT INTO wrong_questions (user_id, question_id, wrong_count, correct_count) VALUES (?, ?, 1, 0)',
              [userId, question_id]
            )
          }
        } else {
          // 如果答对了，检查是否在错题本中
          const [existing] = await connection.query<RowDataPacket[]>(
            'SELECT * FROM wrong_questions WHERE user_id = ? AND question_id = ?',
            [userId, question_id]
          )

          if (existing.length > 0) {
            // 更新正确次数
            await connection.query(
              'UPDATE wrong_questions SET correct_count = correct_count + 1, last_practice_time = NOW() WHERE user_id = ? AND question_id = ?',
              [userId, question_id]
            )

            // 检查是否掌握（连续答对3次认为掌握）
            const [updated] = await connection.query<RowDataPacket[]>(
              'SELECT correct_count, wrong_count FROM wrong_questions WHERE user_id = ? AND question_id = ?',
              [userId, question_id]
            )

            if (updated.length > 0 && updated[0].correct_count >= 3) {
              await connection.query(
                'UPDATE wrong_questions SET is_mastered = TRUE WHERE user_id = ? AND question_id = ?',
                [userId, question_id]
              )
            }
          }
        }

        await connection.commit()

        const response: ApiResponse<null> = {
          success: true,
          data: null,
        }
        return res.json(response)
      } catch (error) {
        await connection.rollback()
        throw error
      } finally {
        connection.release()
      }
    } catch (error) {
      console.error('记录练习结果错误:', error)
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : '记录练习结果失败',
      }
      return res.status(500).json(response)
    }
  }

  // 获取错题本列表
  static async getWrongQuestions(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const userId = req.user?.id
      const page = req.query.page ? parseInt(req.query.page as string) : 1
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10
      const mastered = req.query.mastered === 'true' ? true : req.query.mastered === 'false' ? false : undefined
      const offset = (page - 1) * limit

      if (!userId || isNaN(userId)) {
        const response: ApiResponse<any> = {
          success: false,
          error: '未授权访问或用户ID无效',
        }
        return res.status(401).json(response)
      }

      let whereClause = 'WHERE wq.user_id = ?'
      const queryParams = [userId]

      if (mastered !== undefined) {
        whereClause += ' AND wq.is_mastered = ?'
        queryParams.push(mastered ? 1 : 0)
      }

      // 获取错题总数
      const [countResult] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM wrong_questions wq ${whereClause}`,
        queryParams
      )
      const total = countResult[0].total

      // 获取错题列表
      const [wrongQuestions] = await pool.query<RowDataPacket[]>(
        `SELECT 
          wq.*,
          q.content,
          q.question_type,
          q.options,
          q.correct_answer,
          q.explanation,
          q.knowledge_points
        FROM wrong_questions wq
        JOIN questions q ON wq.question_id = q.id
        ${whereClause}
        ORDER BY wq.last_practice_time DESC
        LIMIT ? OFFSET ?`,
        [...queryParams, limit, offset]
      )

      const totalPages = Math.ceil(total / limit)

      const response: ApiResponse<any> = {
        success: true,
        data: {
          wrongQuestions,
          pagination: {
            total,
            totalPages,
            currentPage: page,
            pageSize: limit,
          },
        },
      }
      return res.json(response)
    } catch (error) {
      console.error('获取错题本错误:', error)
      console.error('错误详情:', error instanceof Error ? error.stack : error)
      const response: ApiResponse<any> = {
        success: false,
        error: error instanceof Error ? error.message : '获取错题本失败',
      }
      return res.status(400).json(response)
    }
  }

  // 标记题目为已掌握
  static async markAsMastered(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      const questionId = parseInt(req.params.questionId)

      if (!userId || isNaN(userId)) {
        const response: ApiResponse<null> = {
          success: false,
          error: '未授权访问或用户ID无效',
        }
        return res.status(401).json(response)
      }

      if (isNaN(questionId)) {
        const response: ApiResponse<null> = {
          success: false,
          error: '无效的题目ID',
        }
        return res.status(400).json(response)
      }

      await pool.query('UPDATE wrong_questions SET is_mastered = TRUE WHERE user_id = ? AND question_id = ?', [
        userId,
        questionId,
      ])

      const response: ApiResponse<null> = {
        success: true,
        data: null,
      }
      return res.json(response)
    } catch (error) {
      console.error('标记掌握错误:', error)
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : '标记掌握失败',
      }
      return res.status(500).json(response)
    }
  }

  // 从错题本中移除题目
  static async removeFromWrongQuestions(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      const questionId = parseInt(req.params.questionId)

      if (!userId) {
        const response: ApiResponse<null> = {
          success: false,
          error: '未授权访问',
        }
        return res.status(401).json(response)
      }

      if (isNaN(questionId)) {
        const response: ApiResponse<null> = {
          success: false,
          error: '无效的题目ID',
        }
        return res.status(400).json(response)
      }

      await pool.query('DELETE FROM wrong_questions WHERE user_id = ? AND question_id = ?', [userId, questionId])

      const response: ApiResponse<null> = {
        success: true,
        data: null,
      }
      return res.json(response)
    } catch (error) {
      console.error('移除错题错误:', error)
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : '移除错题失败',
      }
      return res.status(500).json(response)
    }
  }

  // 获取练习统计
  static async getPracticeStats(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const userId = req.user?.id

      if (!userId || isNaN(userId)) {
        const response: ApiResponse<any> = {
          success: false,
          error: '未授权访问或用户ID无效',
        }
        return res.status(401).json(response)
      }

      // 获取总练习次数
      const [totalPractice] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as total FROM practice_records WHERE user_id = ?',
        [userId]
      )

      // 获取正确率
      const [correctRate] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as correct FROM practice_records WHERE user_id = ? AND is_correct = TRUE',
        [userId]
      )

      // 获取错题数量
      const [wrongCount] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as total FROM wrong_questions WHERE user_id = ? AND is_mastered = FALSE',
        [userId]
      )

      // 获取已掌握题目数量
      const [masteredCount] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as total FROM wrong_questions WHERE user_id = ? AND is_mastered = TRUE',
        [userId]
      )

      const total = totalPractice[0].total
      const correct = correctRate[0].correct
      const rate = total > 0 ? ((correct / total) * 100).toFixed(1) : '0.0'

      const response: ApiResponse<any> = {
        success: true,
        data: {
          totalPractice: total,
          correctRate: rate,
          wrongQuestions: wrongCount[0].total,
          masteredQuestions: masteredCount[0].total,
        },
      }
      return res.json(response)
    } catch (error) {
      console.error('获取练习统计错误:', error)
      console.error('错误详情:', error instanceof Error ? error.stack : error)
      const response: ApiResponse<any> = {
        success: false,
        error: error instanceof Error ? error.message : '获取练习统计失败',
      }
      return res.status(400).json(response)
    }
  }

  // 获取用户已练习过的题目ID列表
  static async getPracticedQuestions(req: AuthRequest, res: Response<ApiResponse<number[]>>) {
    try {
      const userId = req.user?.id

      if (!userId || isNaN(userId)) {
        const response: ApiResponse<number[]> = {
          success: false,
          error: '未授权访问或用户ID无效',
        }
        return res.status(401).json(response)
      }

      // 获取用户已练习过的题目ID列表（去重）
      const [practicedQuestions] = await pool.query<RowDataPacket[]>(
        'SELECT DISTINCT question_id FROM practice_records WHERE user_id = ? ORDER BY question_id',
        [userId]
      )

      const questionIds = practicedQuestions.map(row => row.question_id)

      const response: ApiResponse<number[]> = {
        success: true,
        data: questionIds,
      }
      return res.json(response)
    } catch (error) {
      console.error('获取已练习题目列表错误:', error)
      const response: ApiResponse<number[]> = {
        success: false,
        error: error instanceof Error ? error.message : '获取已练习题目列表失败',
      }
      return res.status(500).json(response)
    }
  }

  // 获取所有知识点列表
  static async getKnowledgePoints(req: AuthRequest, res: Response) {
    try {
      // 从questions表中提取所有不重复的知识点
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT DISTINCT JSON_UNQUOTE(JSON_EXTRACT(knowledge_points, CONCAT('$[', numbers.n, ']'))) as knowledge_point
         FROM questions
         CROSS JOIN (
           SELECT 0 as n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 
           UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9
         ) numbers
         WHERE JSON_LENGTH(knowledge_points) > numbers.n
         AND JSON_UNQUOTE(JSON_EXTRACT(knowledge_points, CONCAT('$[', numbers.n, ']'))) IS NOT NULL
         ORDER BY knowledge_point`
      )

      const knowledgePoints = rows.map(row => row.knowledge_point).filter(point => point && point !== 'null')

      const response = {
        success: true,
        data: knowledgePoints,
      }
      return res.json(response)
    } catch (error) {
      console.error('获取知识点列表错误:', error)
      const response = {
        success: false,
        error: error instanceof Error ? error.message : '获取知识点列表失败',
      }
      return res.status(500).json(response)
    }
  }
}
