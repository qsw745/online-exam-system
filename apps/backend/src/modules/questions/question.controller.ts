import { pool } from '@config/database.js'
import { Response } from 'express'
import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { AuthRequest } from 'types/auth.js'
import { ApiResponse } from 'types/response.js'
import { LoggerService } from '../../services/logger.service.js'

interface IQuestion extends RowDataPacket {
  id: number
  title: string
  content: string
  question_type: 'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer'
  difficulty: 'easy' | 'medium' | 'hard'
  options: any // ← 宽松类型，避免解析后 TS 报错
  correct_answer: any
  knowledge_points: any
  tags: any // ← 新增：标签
  explanation: string
  exam_id: number | null
  score: number
  created_at: Date
  updated_at: Date
}

type QuestionData = { question: IQuestion }
type QuestionListData = {
  questions: IQuestion[]
  pagination: { total: number; totalPages: number; currentPage: number; pageSize: number }
}

// ---- 直接替换工具函数 ----
function ensureArrayFromMaybeCsv(input: any): string[] {
  if (Array.isArray(input)) return input.map(String).filter(Boolean)
  if (typeof input === 'string') {
    const normalized = input
      .trim()
      .replace(/[\r\n]+/g, ',')
      .replace(/[，；;]/g, ',')
    return normalized
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
  }
  if (input != null && (typeof input === 'number' || typeof input === 'boolean')) {
    return [String(input)]
  }
  return []
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

      // tags 支持：?tags=backend,Java,算法
      const tagsParam = req.query.tags
      const tags = ensureArrayFromMaybeCsv(tagsParam)

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
      if (tags.length > 0) {
        // 所有传入标签都需要命中（AND 模式），若要“任一命中”改成用 OR 包裹
        for (const t of tags) {
          conditions.push(`JSON_CONTAINS(tags, JSON_QUOTE(?))`)
          values.push(t)
        }
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
      const total = (totalRows as any)[0].total
      const totalPages = Math.ceil(total / limit)

      // 解析 JSON 字段
      const parsedQuestions = (questions as IQuestion[]).map((q: IQuestion) => {
        try {
          if (q.options && typeof q.options === 'string') q.options = JSON.parse(q.options)
          if (q.knowledge_points && typeof q.knowledge_points === 'string')
            q.knowledge_points = JSON.parse(q.knowledge_points)
          if (q.tags && typeof q.tags === 'string') q.tags = JSON.parse(q.tags)
        } catch (e) {
          console.error(`题目ID ${q.id} 解析字段失败:`, e)
        }
        return q
      })

      return res.json({
        success: true,
        data: {
          questions: parsedQuestions,
          pagination: { total, totalPages, currentPage: page, pageSize: limit },
        },
      })
    } catch (error) {
      console.error('获取问题列表错误:', error)
      return res
        .status(500)
        .json({ success: false, error: error instanceof Error ? error.message : '获取问题列表失败' })
    }
  }

  static async getById(req: AuthRequest, res: Response<ApiResponse<QuestionData>>) {
    try {
      const questionId = parseInt(req.params.id)
      if (isNaN(questionId) || questionId <= 0) {
        return res.status(400).json({ success: false, error: '无效的题目ID' })
      }

      const [questions] = await pool.query<IQuestion[]>('SELECT * FROM questions WHERE id = ?', [questionId])
      if (questions.length === 0) {
        return res.status(404).json({ success: false, error: '问题不存在' })
      }

      const question = questions[0]
      try {
        if (question.options && typeof question.options === 'string') question.options = JSON.parse(question.options)
        if (question.knowledge_points && typeof question.knowledge_points === 'string')
          question.knowledge_points = JSON.parse(question.knowledge_points)
        if (question.tags && typeof question.tags === 'string') question.tags = JSON.parse(question.tags)
      } catch (e) {
        console.error('解析JSON字段失败:', e)
      }

      return res.json({ success: true, data: { question } })
    } catch (error) {
      console.error('获取问题详情错误:', error)
      return res
        .status(500)
        .json({ success: false, error: error instanceof Error ? error.message : '获取问题详情失败' })
    }
  }

  // ---- 直接替换 create 方法 ----
  static async create(req: AuthRequest, res: Response<ApiResponse<QuestionData>>) {
    try {
      const {
        title,
        content,
        question_type,
        options,
        correct_answer,
        knowledge_points,
        tags,
        explanation,
        difficulty = 'medium',
        exam_id = null,
        score = 10,
      } = req.body

      if (!content || !question_type || correct_answer === undefined) {
        return res.status(400).json({ success: false, error: '缺少必填字段：题目内容、题目类型和正确答案' })
      }

      const validTypes = ['single_choice', 'multiple_choice', 'true_false', 'short_answer']
      if (!validTypes.includes(question_type)) return res.status(400).json({ success: false, error: '无效的题目类型' })
      const validDifficulties = ['easy', 'medium', 'hard']
      if (!validDifficulties.includes(difficulty))
        return res.status(400).json({ success: false, error: '无效的难度等级' })

      let optionsJson: string | null = null
      if (question_type === 'single_choice' || question_type === 'multiple_choice') {
        if (!Array.isArray(options) || options.length === 0)
          return res.status(400).json({ success: false, error: '选择题必须提供选项' })
        optionsJson = JSON.stringify(options)
      }

      const correctAnswerStr = typeof correct_answer === 'string' ? correct_answer : JSON.stringify(correct_answer)
      const knowledgePointsStr = JSON.stringify(ensureArrayFromMaybeCsv(knowledge_points))
      const tagsStr = JSON.stringify(ensureArrayFromMaybeCsv(tags))

      const questionTitle = title || (content.length > 50 ? content.substring(0, 50) + '...' : content)

      const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO questions
       (title, content, question_type, options, correct_answer, knowledge_points, tags, explanation, difficulty, exam_id, score)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          questionTitle,
          content,
          question_type,
          optionsJson,
          correctAnswerStr,
          knowledgePointsStr,
          tagsStr,
          explanation || '',
          difficulty,
          exam_id,
          score,
        ]
      )

      const [question] = await pool.query<IQuestion[]>('SELECT * FROM questions WHERE id = ?', [result.insertId])

      await LoggerService.logUserAction({
        userId: req.user?.id || 0,
        username: req.user?.username,
        action: 'create_question',
        resourceType: 'question',
        resourceId: Number(result.insertId),
        details: { questionType: question_type, title: questionTitle, difficulty, tags: ensureArrayFromMaybeCsv(tags) },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      })

      return res.status(201).json({ success: true, data: { question: question[0] } })
    } catch (error) {
      console.error('创建问题错误:', error)
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : '创建问题失败' })
    }
  }

  // ---- 直接替换 update 方法 ----
  static async update(req: AuthRequest, res: Response<ApiResponse<QuestionData>>) {
    try {
      const { id } = req.params
      const {
        title,
        content,
        question_type,
        options,
        correct_answer,
        knowledge_points,
        tags,
        explanation,
        difficulty,
        exam_id,
        score,
      } = req.body

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
        values.push(options == null ? null : JSON.stringify(options))
      }
      if (correct_answer !== undefined) {
        updates.push('correct_answer = ?')
        values.push(typeof correct_answer === 'string' ? correct_answer : JSON.stringify(correct_answer))
      }
      if (knowledge_points !== undefined) {
        updates.push('knowledge_points = ?')
        values.push(JSON.stringify(ensureArrayFromMaybeCsv(knowledge_points)))
      }
      if (tags !== undefined) {
        updates.push('tags = ?')
        values.push(JSON.stringify(ensureArrayFromMaybeCsv(tags)))
      }
      if (explanation !== undefined) {
        updates.push('explanation = ?')
        values.push(explanation || '')
      }
      if (difficulty !== undefined) {
        updates.push('difficulty = ?')
        values.push(difficulty)
      }
      if (exam_id !== undefined) {
        updates.push('exam_id = ?')
        values.push(exam_id ?? null)
      }
      if (score !== undefined) {
        updates.push('score = ?')
        values.push(Number(score))
      }

      if (updates.length === 0) return res.status(400).json({ success: false, error: '没有需要更新的字段' })
      values.push(parseInt(id, 10))

      const [result] = await pool.query<ResultSetHeader>(
        `UPDATE questions SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
        values
      )
      if (result.affectedRows === 0) return res.status(404).json({ success: false, error: '问题不存在' })

      const [question] = await pool.query<IQuestion[]>('SELECT * FROM questions WHERE id = ?', [parseInt(id, 10)])

      await LoggerService.logUserAction({
        userId: req.user?.id || 0,
        username: req.user?.username,
        action: 'update_question',
        resourceType: 'question',
        resourceId: Number(id),
        details: { updatedFields: updates, questionId: parseInt(id, 10) },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      })

      return res.json({ success: true, data: { question: question[0] } })
    } catch (error) {
      console.error('更新问题错误:', error)
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : '更新问题失败' })
    }
  }

  static async delete(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const { id } = req.params
      const [result] = await pool.query<ResultSetHeader>('DELETE FROM questions WHERE id = ?', [parseInt(id)])
      if (result.affectedRows === 0) return res.status(404).json({ success: false, error: '问题不存在' })

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
      return res.json({ success: true, data: null })
    } catch (error) {
      console.error('删除问题错误:', error)
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : '删除问题失败' })
    }
  }

  // ---- 直接替换 bulkImport 方法 ----
  static async bulkImport(
    req: AuthRequest,
    res: Response<ApiResponse<{ success_count: number; fail_count: number; errors: string[] }>>
  ) {
    try {
      const { questions } = req.body
      if (!questions || !Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ success: false, error: '请提供有效的题目数据' })
      }
      if (questions.length > 1000) {
        return res.status(400).json({ success: false, error: '单次导入题目数量不能超过1000道' })
      }

      let successCount = 0
      let failCount = 0
      const errors: string[] = []
      const validTypes = ['single_choice', 'multiple_choice', 'true_false', 'short_answer']
      const validDifficulties = ['easy', 'medium', 'hard']

      for (let i = 0; i < questions.length; i++) {
        try {
          const q = questions[i]
          const {
            title,
            content,
            question_type,
            options,
            answer,
            correct_answer,
            explanation,
            difficulty = 'medium',
            score = 10,
          } = q

          if (!content || !question_type || (!answer && correct_answer === undefined)) {
            failCount++
            errors.push(`第${i + 1}题：缺少必填字段（题目内容、题目类型或答案）`)
            continue
          }
          if (!validTypes.includes(question_type)) {
            failCount++
            errors.push(`第${i + 1}题：无效的题目类型 ${question_type}`)
            continue
          }
          if (!validDifficulties.includes(difficulty)) {
            failCount++
            errors.push(`第${i + 1}题：无效的难度等级 ${difficulty}`)
            continue
          }

          // 兼容中文键名
          const tagsRaw = (q as any).tags ?? (q as any)['标签'] ?? (q as any).tag ?? (q as any).Tags
          const knowledgeRaw = (q as any).knowledge_points ?? (q as any)['知识点'] ?? (q as any)['知識點']

          let optionsJson = null
          if (question_type === 'single_choice' || question_type === 'multiple_choice') {
            if (!Array.isArray(options) || options.length === 0) {
              failCount++
              errors.push(`第${i + 1}题：选择题必须提供选项`)
              continue
            }
            const validOptions = options.every(
              (opt: any) =>
                typeof opt === 'object' && typeof opt.content === 'string' && typeof opt.is_correct === 'boolean'
            )
            if (!validOptions) {
              failCount++
              errors.push(`第${i + 1}题：选项格式不正确，应包含 content(string) 和 is_correct(boolean)`)
              continue
            }
            optionsJson = JSON.stringify(options)
          }

          const finalCorrect = correct_answer !== undefined ? correct_answer : answer
          const correctAnswerStr = typeof finalCorrect === 'string' ? finalCorrect : JSON.stringify(finalCorrect)
          const knowledgePointsStr = JSON.stringify(ensureArrayFromMaybeCsv(knowledgeRaw))
          const tagsStr = JSON.stringify(ensureArrayFromMaybeCsv(tagsRaw))
          console.log('=====tagsStr=======', tagsStr)
          // 去重：同内容 & 类型
          const [existing] = await pool.query<RowDataPacket[]>(
            'SELECT id FROM questions WHERE content = ? AND question_type = ?',
            [content, question_type]
          )

          if ((existing as any).length > 0) {
            const existId = (existing as any)[0].id
            console.log('=====req.query.upsert=====', req.query.upsert)
            const doUpsert = req.query.upsert === 'true' || req.body?.upsert === true
            if (doUpsert) {
              await pool.query(
                `UPDATE questions
                 SET tags=?, knowledge_points=?, explanation=?, score=?, difficulty=?, updated_at=NOW()
               WHERE id=?`,
                [tagsStr, knowledgePointsStr, explanation || '', score, difficulty, existId]
              )
              successCount++
            } else {
              failCount++
              errors.push(`第${i + 1}题：题目已存在，跳过导入`)
            }
            continue
          }

          const questionTitle = title || (content.length > 50 ? content.substring(0, 50) + '...' : content)
          await pool.query(
            `INSERT INTO questions (title, content, question_type, options, correct_answer, knowledge_points, tags, explanation, difficulty, exam_id, score)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              questionTitle,
              content,
              question_type,
              optionsJson,
              correctAnswerStr,
              knowledgePointsStr,
              tagsStr,
              explanation || '',
              difficulty,
              null,
              score,
            ]
          )
          successCount++
        } catch (e: any) {
          failCount++
          errors.push(`第${i + 1}题导入失败：${e?.message || '未知错误'}`)
        }
      }

      await LoggerService.logUserAction({
        userId: req.user?.id || 0,
        username: req.user?.username,
        action: 'bulk_import_questions',
        resourceType: 'question',
        details: { totalQuestions: questions.length, successCount, failCount, errorCount: errors.length },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      })

      return res
        .status(200)
        .json({ success: true, data: { success_count: successCount, fail_count: failCount, errors } })
    } catch (error) {
      console.error('批量导入问题错误:', error)
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : '批量导入失败' })
    }
  }

  // ====== 以下保持你原有练习/错题本/统计接口 ======

  static async recordPractice(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      const { question_id, is_correct, answer } = req.body
      if (!userId || isNaN(userId)) return res.status(401).json({ success: false, error: '未授权访问或用户ID无效' })
      if (!question_id || is_correct === undefined)
        return res.status(400).json({ success: false, error: '缺少必要参数' })

      const connection = await pool.getConnection()
      try {
        await connection.beginTransaction()
        await connection.query(
          'INSERT INTO practice_records (user_id, question_id, is_correct, user_answer) VALUES (?, ?, ?, ?)',
          [userId, question_id, is_correct, JSON.stringify(answer)]
        )

        if (!is_correct) {
          const [existing] = await connection.query<RowDataPacket[]>(
            'SELECT * FROM wrong_questions WHERE user_id = ? AND question_id = ?',
            [userId, question_id]
          )
          if ((existing as any).length > 0) {
            await connection.query(
              'UPDATE wrong_questions SET wrong_count = wrong_count + 1, last_practice_time = NOW(), is_mastered = FALSE WHERE user_id = ? AND question_id = ?',
              [userId, question_id]
            )
          } else {
            await connection.query(
              'INSERT INTO wrong_questions (user_id, question_id, wrong_count, correct_count) VALUES (?, ?, 1, 0)',
              [userId, question_id]
            )
          }
        } else {
          const [existing] = await connection.query<RowDataPacket[]>(
            'SELECT * FROM wrong_questions WHERE user_id = ? AND question_id = ?',
            [userId, question_id]
          )
          if ((existing as any).length > 0) {
            await connection.query(
              'UPDATE wrong_questions SET correct_count = correct_count + 1, last_practice_time = NOW() WHERE user_id = ? AND question_id = ?',
              [userId, question_id]
            )
            const [updated] = await connection.query<RowDataPacket[]>(
              'SELECT correct_count FROM wrong_questions WHERE user_id = ? AND question_id = ?',
              [userId, question_id]
            )
            if ((updated as any)[0]?.correct_count >= 3) {
              await connection.query(
                'UPDATE wrong_questions SET is_mastered = TRUE WHERE user_id = ? AND question_id = ?',
                [userId, question_id]
              )
            }
          }
        }

        await connection.commit()
        return res.json({ success: true, data: null })
      } catch (e) {
        await connection.rollback()
        throw e
      } finally {
        connection.release()
      }
    } catch (error) {
      console.error('记录练习结果错误:', error)
      return res
        .status(500)
        .json({ success: false, error: error instanceof Error ? error.message : '记录练习结果失败' })
    }
  }

  static async getWrongQuestions(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const userId = req.user?.id
      const page = req.query.page ? parseInt(req.query.page as string) : 1
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10
      const mastered = req.query.mastered === 'true' ? true : req.query.mastered === 'false' ? false : undefined
      const offset = (page - 1) * limit

      if (!userId || isNaN(userId)) return res.status(401).json({ success: false, error: '未授权访问或用户ID无效' })

      let whereClause = 'WHERE wq.user_id = ?'
      const queryParams: any[] = [userId]
      if (mastered !== undefined) {
        whereClause += ' AND wq.is_mastered = ?'
        queryParams.push(mastered ? 1 : 0)
      }

      const [countResult] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM wrong_questions wq ${whereClause}`,
        queryParams
      )
      const total = (countResult as any)[0].total

      const [wrongQuestions] = await pool.query<RowDataPacket[]>(
        `SELECT 
          wq.*, q.content, q.question_type, q.options, q.correct_answer, q.explanation, q.knowledge_points, q.tags
         FROM wrong_questions wq
         JOIN questions q ON wq.question_id = q.id
         ${whereClause}
         ORDER BY wq.last_practice_time DESC
         LIMIT ? OFFSET ?`,
        [...queryParams, limit, offset]
      )

      return res.json({
        success: true,
        data: {
          wrongQuestions,
          pagination: { total, totalPages: Math.ceil(total / limit), currentPage: page, pageSize: limit },
        },
      })
    } catch (error) {
      console.error('获取错题本错误:', error)
      return res.status(400).json({ success: false, error: error instanceof Error ? error.message : '获取错题本失败' })
    }
  }

  static async markAsMastered(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      const questionId = parseInt(req.params.questionId)
      if (!userId || isNaN(userId)) return res.status(401).json({ success: false, error: '未授权访问或用户ID无效' })
      if (isNaN(questionId)) return res.status(400).json({ success: false, error: '无效的题目ID' })

      await pool.query('UPDATE wrong_questions SET is_mastered = TRUE WHERE user_id = ? AND question_id = ?', [
        userId,
        questionId,
      ])
      return res.json({ success: true, data: null })
    } catch (error) {
      console.error('标记掌握错误:', error)
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : '标记掌握失败' })
    }
  }

  static async removeFromWrongQuestions(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      const questionId = parseInt(req.params.questionId)
      if (!userId) return res.status(401).json({ success: false, error: '未授权访问' })
      if (isNaN(questionId)) return res.status(400).json({ success: false, error: '无效的题目ID' })

      await pool.query('DELETE FROM wrong_questions WHERE user_id = ? AND question_id = ?', [userId, questionId])
      return res.json({ success: true, data: null })
    } catch (error) {
      console.error('移除错题错误:', error)
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : '移除错题失败' })
    }
  }

  static async getPracticeStats(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const userId = req.user?.id
      if (!userId || isNaN(userId)) return res.status(401).json({ success: false, error: '未授权访问或用户ID无效' })

      const [totalPractice] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as total FROM practice_records WHERE user_id = ?',
        [userId]
      )
      const [correctRate] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as correct FROM practice_records WHERE user_id = ? AND is_correct = TRUE',
        [userId]
      )
      const [wrongCount] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as total FROM wrong_questions WHERE user_id = ? AND is_mastered = FALSE',
        [userId]
      )
      const [masteredCount] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as total FROM wrong_questions WHERE user_id = ? AND is_mastered = TRUE',
        [userId]
      )

      const total = (totalPractice as any)[0].total
      const correct = (correctRate as any)[0].correct
      const rate = total > 0 ? ((correct / total) * 100).toFixed(1) : '0.0'

      return res.json({
        success: true,
        data: {
          totalPractice: total,
          correctRate: rate,
          wrongQuestions: (wrongCount as any)[0].total,
          masteredQuestions: (masteredCount as any)[0].total,
        },
      })
    } catch (error) {
      console.error('获取练习统计错误:', error)
      return res
        .status(400)
        .json({ success: false, error: error instanceof Error ? error.message : '获取练习统计失败' })
    }
  }

  static async getPracticedQuestions(req: AuthRequest, res: Response<ApiResponse<number[]>>) {
    try {
      const userId = req.user?.id
      if (!userId || isNaN(userId)) return res.status(401).json({ success: false, error: '未授权访问或用户ID无效' })

      const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT DISTINCT question_id FROM practice_records WHERE user_id = ? ORDER BY question_id',
        [userId]
      )
      const ids = (rows as any[]).map(r => r.question_id as number)
      return res.json({ success: true, data: ids })
    } catch (error) {
      console.error('获取已练习题目列表错误:', error)
      return res
        .status(500)
        .json({ success: false, error: error instanceof Error ? error.message : '获取已练习题目列表失败' })
    }
  }

  // ===== 标签聚合 =====
  static async getTags(req: AuthRequest, res: Response) {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT DISTINCT JSON_UNQUOTE(JSON_EXTRACT(tags, CONCAT('$[', numbers.n, ']'))) as tag
           FROM questions
           CROSS JOIN (
             SELECT 0 as n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
             UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9
             UNION SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14
             UNION SELECT 15 UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19
           ) numbers
          WHERE JSON_LENGTH(tags) > numbers.n
            AND JSON_UNQUOTE(JSON_EXTRACT(tags, CONCAT('$[', numbers.n, ']'))) IS NOT NULL
          ORDER BY tag`
      )

      const tags = (rows as any[]).map(r => r.tag).filter((t: string | null) => !!t && t !== 'null')
      return res.json({ success: true, data: tags })
    } catch (error) {
      console.error('获取标签列表错误:', error)
      return res
        .status(500)
        .json({ success: false, error: error instanceof Error ? error.message : '获取标签列表失败' })
    }
  }

  // ===== 知识点聚合（保留原实现） =====
  static async getKnowledgePoints(req: AuthRequest, res: Response) {
    try {
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
      const knowledgePoints = (rows as any[])
        .map(r => r.knowledge_point)
        .filter((p: string | null) => !!p && p !== 'null')
      return res.json({ success: true, data: knowledgePoints })
    } catch (error) {
      console.error('获取知识点列表错误:', error)
      return res
        .status(500)
        .json({ success: false, error: error instanceof Error ? error.message : '获取知识点列表失败' })
    }
  }
}
