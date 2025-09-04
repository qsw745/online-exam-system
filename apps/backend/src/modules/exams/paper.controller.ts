import { Response } from 'express'
import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool } from '../config/database.js'
import { AuthRequest } from '../types/auth.js'
import { ApiResponse } from '../types/response.js'

interface IPaper extends RowDataPacket {
  id: number
  title: string
  description: string
  difficulty: 'easy' | 'medium' | 'hard'
  total_score: number
  duration: number
  created_at: Date
  updated_at: Date
}

interface IPaperQuestion extends RowDataPacket {
  paper_id: number
  question_id: number
  score: number
  order: number
  question_title: string
  question_type: string
  question_content: string
  question_options: string
  question_answer: string
}

type PaperData = {
  paper: IPaper
}

type PaperListData = {
  papers: IPaper[]
  total: number
}

type PaperQuestionData = {
  questions: IPaperQuestion[]
}

type AddQuestionData = {
  questionId: number
}

export class PaperController {
  static async addQuestion(req: AuthRequest, res: Response<ApiResponse<AddQuestionData>>) {
    try {
      const { id } = req.params
      const { questionId, score, order } = req.body

      if (!questionId || !score || order === undefined) {
        const errorResponse: ApiResponse<AddQuestionData> = {
          success: false,
          error: '缺少必填字段',
        }
        return res.status(400).json(errorResponse)
      }

      const [result] = await pool.query<ResultSetHeader>(
        'INSERT INTO paper_questions (paper_id, question_id, score, `order`) VALUES (?, ?, ?, ?)',
        [parseInt(id), parseInt(questionId), score, order]
      )

      const successResponse: ApiResponse<AddQuestionData> = {
        success: true,
        data: { questionId: result.insertId },
      }
      return res.status(201).json(successResponse)
    } catch (error) {
      console.error('添加试卷题目错误:', error)
      const errorResponse: ApiResponse<AddQuestionData> = {
        success: false,
        error: error instanceof Error ? error.message : '添加试卷题目失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  static async removeQuestion(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const { id, questionId } = req.params

      const [result] = await pool.query<ResultSetHeader>(
        'DELETE FROM paper_questions WHERE paper_id = ? AND question_id = ?',
        [parseInt(id), parseInt(questionId)]
      )

      if (result.affectedRows === 0) {
        const errorResponse: ApiResponse<null> = {
          success: false,
          error: '试卷题目不存在',
        }
        return res.status(404).json(errorResponse)
      }

      const successResponse: ApiResponse<null> = {
        success: true,
        data: null,
      }
      return res.json(successResponse)
    } catch (error) {
      console.error('移除试卷题目错误:', error)
      const errorResponse: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : '移除试卷题目失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  static async getQuestions(req: AuthRequest, res: Response<ApiResponse<PaperQuestionData>>) {
    try {
      const { id } = req.params

      const [questions] = await pool.query<IPaperQuestion[]>(
        `SELECT pq.*, q.title as question_title, q.question_type as question_type, 
                q.content as question_content, q.options as question_options, 
                q.correct_answer as question_answer
         FROM paper_questions pq
         JOIN questions q ON pq.question_id = q.id
         WHERE pq.paper_id = ?
         ORDER BY pq.order ASC`,
        [parseInt(id)]
      )

      const successResponse: ApiResponse<PaperQuestionData> = {
        success: true,
        data: { questions },
      }
      return res.json(successResponse)
    } catch (error) {
      console.error('获取试卷题目列表错误:', error)
      const errorResponse: ApiResponse<PaperQuestionData> = {
        success: false,
        error: error instanceof Error ? error.message : '获取试卷题目列表失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  static async updateQuestionOrder(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const { id } = req.params
      const { orders } = req.body

      if (!Array.isArray(orders) || orders.length === 0) {
        const errorResponse: ApiResponse<null> = {
          success: false,
          error: '无效的题目顺序数据',
        }
        return res.status(400).json(errorResponse)
      }

      await Promise.all(
        orders.map(({ questionId, order }) =>
          pool.query('UPDATE paper_questions SET `order` = ? WHERE paper_id = ? AND question_id = ?', [
            order,
            parseInt(id),
            questionId,
          ])
        )
      )

      const successResponse: ApiResponse<null> = {
        success: true,
        data: null,
      }
      return res.json(successResponse)
    } catch (error) {
      console.error('更新试卷题目顺序错误:', error)
      const errorResponse: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : '更新试卷题目顺序失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  static async list(req: AuthRequest, res: Response<ApiResponse<PaperListData>>) {
    try {
      const difficulty = req.query.difficulty as 'easy' | 'medium' | 'hard' | undefined
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0

      const conditions: string[] = []
      const values: any[] = []

      if (difficulty) {
        conditions.push('difficulty = ?')
        values.push(difficulty)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const [papers] = await pool.query<IPaper[]>(
        `SELECT * FROM papers ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...values, limit, offset]
      )

      const [totalRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM papers ${whereClause}`,
        values
      )

      const successResponse: ApiResponse<PaperListData> = {
        success: true,
        data: {
          papers,
          total: totalRows[0].total,
        },
      }
      return res.json(successResponse)
    } catch (error) {
      console.error('获取试卷列表错误:', error)
      const errorResponse: ApiResponse<PaperListData> = {
        success: false,
        error: error instanceof Error ? error.message : '获取试卷列表失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  static async getById(req: AuthRequest, res: Response<ApiResponse<PaperData>>) {
    try {
      const { id } = req.params

      const [papers] = await pool.query<IPaper[]>('SELECT * FROM papers WHERE id = ?', [parseInt(id)])

      if (papers.length === 0) {
        const errorResponse: ApiResponse<PaperData> = {
          success: false,
          error: '试卷不存在',
        }
        return res.status(404).json(errorResponse)
      }

      const successResponse: ApiResponse<PaperData> = {
        success: true,
        data: { paper: papers[0] },
      }
      return res.json(successResponse)
    } catch (error) {
      console.error('获取试卷详情错误:', error)
      const errorResponse: ApiResponse<PaperData> = {
        success: false,
        error: error instanceof Error ? error.message : '获取试卷详情失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  static async create(req: AuthRequest, res: Response<ApiResponse<PaperData>>) {
    try {
      const { title, description, difficulty, total_score, duration } = req.body

      if (!title || !description || !difficulty || !total_score) {
        const errorResponse: ApiResponse<PaperData> = {
          success: false,
          error: '缺少必填字段',
        }
        return res.status(400).json(errorResponse)
      }

      const [result] = await pool.query<ResultSetHeader>(
        'INSERT INTO papers (title, description, difficulty, total_score, duration) VALUES (?, ?, ?, ?, ?)',
        [title, description, difficulty, total_score, duration]
      )

      const [paper] = await pool.query<IPaper[]>('SELECT * FROM papers WHERE id = ?', [result.insertId])

      const successResponse: ApiResponse<PaperData> = {
        success: true,
        data: { paper: paper[0] },
      }
      return res.status(201).json(successResponse)
    } catch (error) {
      console.error('创建试卷错误:', error)
      const errorResponse: ApiResponse<PaperData> = {
        success: false,
        error: error instanceof Error ? error.message : '创建试卷失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  static async update(req: AuthRequest, res: Response<ApiResponse<PaperData>>) {
    try {
      const { id } = req.params
      const { title, description, difficulty, total_score, duration } = req.body

      if (!title || !description || !difficulty || !total_score) {
        const errorResponse: ApiResponse<PaperData> = {
          success: false,
          error: '缺少必填字段',
        }
        return res.status(400).json(errorResponse)
      }

      const [result] = await pool.query<ResultSetHeader>(
        'UPDATE papers SET title = ?, description = ?, difficulty = ?, total_score = ?, duration = ? WHERE id = ?',
        [title, description, difficulty, total_score, duration, parseInt(id)]
      )

      if (result.affectedRows === 0) {
        const errorResponse: ApiResponse<PaperData> = {
          success: false,
          error: '试卷不存在',
        }
        return res.status(404).json(errorResponse)
      }

      const [paper] = await pool.query<IPaper[]>('SELECT * FROM papers WHERE id = ?', [parseInt(id)])

      const successResponse: ApiResponse<PaperData> = {
        success: true,
        data: { paper: paper[0] },
      }
      return res.json(successResponse)
    } catch (error) {
      console.error('更新试卷错误:', error)
      const errorResponse: ApiResponse<PaperData> = {
        success: false,
        error: error instanceof Error ? error.message : '更新试卷失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  static async delete(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const { id } = req.params

      const [result] = await pool.query<ResultSetHeader>('DELETE FROM papers WHERE id = ?', [parseInt(id)])

      if (result.affectedRows === 0) {
        const errorResponse: ApiResponse<null> = {
          success: false,
          error: '试卷不存在',
        }
        return res.status(404).json(errorResponse)
      }

      const successResponse: ApiResponse<null> = {
        success: true,
        data: null,
      }
      return res.json(successResponse)
    } catch (error) {
      console.error('删除试卷错误:', error)
      const errorResponse: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : '删除试卷失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  // 智能组卷
  static async smartGenerate(req: AuthRequest, res: Response) {
    try {
      const body = req.body as {
        title: string
        description: string
        duration: number
        difficulty: 'easy' | 'medium' | 'hard' | 'mixed'
        totalQuestions: number
        questionTypes: Record<'single_choice' | 'multiple_choice' | 'true_false' | 'fill_blank' | 'essay', number>
        difficultyDistribution: Record<'easy' | 'medium' | 'hard', number> // 百分比
        knowledgePoints: string[]
        totalScore: number
      }

      // ---------- 0) 入参清洗 ----------
      const totalQuestions = Number(body.totalQuestions) || 0
      const totalScore = Number(body.totalScore) || 0

      const questionTypes = {
        single_choice: Number(body.questionTypes?.single_choice) || 0,
        multiple_choice: Number(body.questionTypes?.multiple_choice) || 0,
        true_false: Number(body.questionTypes?.true_false) || 0,
        fill_blank: Number(body.questionTypes?.fill_blank) || 0,
        essay: Number(body.questionTypes?.essay) || 0,
      }

      const difficultyDist = {
        easy: Number(body.difficultyDistribution?.easy) || 0,
        medium: Number(body.difficultyDistribution?.medium) || 0,
        hard: Number(body.difficultyDistribution?.hard) || 0,
      }

      const knowledgePoints = Array.isArray(body.knowledgePoints) ? body.knowledgePoints.filter(Boolean) : []

      // ---------- 1) 公共 WHERE 条件（仅知识点；难度由配额控制，不在此等值过滤） ----------
      const baseConds: string[] = []
      const baseParams: any[] = []

      if (knowledgePoints.length > 0) {
        // 动态展开 LIKE，占位符与参数一一对应
        const orLikes = knowledgePoints.map(() => 'knowledge_points LIKE ?').join(' OR ')
        baseConds.push(`(${orLikes})`)
        baseParams.push(...knowledgePoints.map(kp => `%${kp}%`))
      }

      // ---------- 2) 小工具 ----------
      const typeMap: Record<string, string> = {
        single_choice: 'single',
        multiple_choice: 'multiple',
        true_false: 'judge',
        fill_blank: 'fill',
        essay: 'essay',
      }
      const toDbType = (uiType: string) => typeMap[uiType] ?? uiType

      // 动态 NOT IN (?,?...?)
      const qs = (n: number) => new Array(n).fill('?').join(',')

      // 注意：为避免 “Incorrect arguments to mysqld_stmt_execute”，不对 LIMIT 使用占位符
      const asLimit = (n: number) => String(Math.max(0, Math.trunc(n || 0)))

      // 安全拼接 WHERE（不带 WHERE 关键字）
      const buildWhereAndParams = (extraConds: string[], extraParams: any[]) => {
        const conds = [...baseConds, ...extraConds]
        const params = [...baseParams, ...extraParams]
        return {
          whereSql: conds.length ? `WHERE ${conds.join(' AND ')}` : '',
          params,
        }
      }

      // 抽题函数
      const fetchBy = async (opts: {
        questionType?: string // DB question_type
        difficulty?: 'easy' | 'medium' | 'hard'
        limit: number
        excludeIds?: string[]
      }) => {
        const extraConds: string[] = []
        const extraParams: any[] = []

        if (opts.questionType) {
          extraConds.push('question_type = ?')
          extraParams.push(opts.questionType)
        }

        if (opts.difficulty) {
          extraConds.push('difficulty = ?')
          extraParams.push(opts.difficulty)
        }

        if (opts.excludeIds && opts.excludeIds.length) {
          extraConds.push(`id NOT IN (${qs(opts.excludeIds.length)})`)
          extraParams.push(...opts.excludeIds)
        }

        const { whereSql, params } = buildWhereAndParams(extraConds, extraParams)

        const sql = `
        SELECT id, content, question_type, difficulty, knowledge_points
        FROM questions
        ${whereSql}
        ORDER BY RAND()
        LIMIT ${asLimit(opts.limit)}
      `

        // 可临时打开以下日志快速定位占位符/参数是否对齐
        // const expected = (sql.match(/\?/g) || []).length;
        // console.log({ expected, paramsLen: params.length, sql, params });

        const [rows] = (await pool.execute(sql, params)) as [RowDataPacket[], any]
        return rows as any[]
      }

      // ---------- 3) 计算各题型在三种难度下的配额 ----------
      const selected: any[] = []

      const allocByDifficulty = (count: number) => {
        const raw = {
          easy: (count * difficultyDist.easy) / 100,
          medium: (count * difficultyDist.medium) / 100,
          hard: (count * difficultyDist.hard) / 100,
        }
        const base = {
          easy: Math.floor(raw.easy),
          medium: Math.floor(raw.medium),
          hard: Math.floor(raw.hard),
        }
        let remain = count - (base.easy + base.medium + base.hard)

        const order = (['easy', 'medium', 'hard'] as const)
          .map(k => ({ k, frac: raw[k] - Math.floor(raw[k]) }))
          .sort((a, b) => b.frac - a.frac)

        for (let i = 0; i < remain; i++) {
          // @ts-ignore
          base[order[i % order.length].k] += 1
        }
        return base // {easy, medium, hard}
      }

      for (const [uiType, totalOfTypeRaw] of Object.entries(questionTypes)) {
        const totalOfType = Number(totalOfTypeRaw) || 0
        if (totalOfType <= 0) continue

        const dbType = toDbType(uiType)
        const need = allocByDifficulty(totalOfType)

        for (const diff of ['easy', 'medium', 'hard'] as const) {
          const n = Number(need[diff]) || 0
          if (n <= 0) continue

          const rows = await fetchBy({
            questionType: dbType,
            difficulty: diff,
            limit: n,
            excludeIds: selected.length ? selected.map(q => q.id) : [],
          })
          selected.push(...rows)
        }
      }

      // ---------- 4) 若不足总题数，按综合条件随机补齐 ----------
      if (selected.length < totalQuestions) {
        const remain = totalQuestions - selected.length
        const rows = await fetchBy({
          limit: remain,
          excludeIds: selected.length ? selected.map(q => q.id) : [],
        })
        selected.push(...rows)
      }

      // 去重 + 截断到需求数量
      const uniq = new Map<string, any>()
      for (const q of selected) if (!uniq.has(q.id)) uniq.set(q.id, q)
      const finalQuestions = Array.from(uniq.values()).slice(0, totalQuestions)

      // ---------- 5) 分数分配（总分严格等于 totalScore） ----------
      const per = Math.floor(totalScore / Math.max(finalQuestions.length, 1))
      let rest = totalScore - per * Math.max(finalQuestions.length, 1)
      const withScore = finalQuestions.map(q => ({ ...q, score: per }))
      for (let i = 0; i < withScore.length && rest > 0; i++) {
        withScore[i].score += 1
        rest--
      }

      // ---------- 6) 返回 ----------
      return res.json({
        success: true,
        data: {
          questions: withScore,
          summary: {
            totalQuestions: withScore.length,
            totalScore: withScore.reduce((s, q) => s + (q.score || 0), 0),
            questionTypeDistribution: Object.keys(questionTypes).reduce((acc: Record<string, number>, k) => {
              const dbType = toDbType(k)
              acc[k] = withScore.filter(q => q.question_type === dbType || q.question_type === k).length
              return acc
            }, {}),
            difficultyDistribution: {
              easy: withScore.filter(q => q.difficulty === 'easy').length,
              medium: withScore.filter(q => q.difficulty === 'medium').length,
              hard: withScore.filter(q => q.difficulty === 'hard').length,
            },
          },
        },
      })
    } catch (err: any) {
      console.error('smart-generate failed:', err)
      return res.status(500).json({ success: false, error: err?.message || '智能组卷失败' })
    }
  }

  // 创建试卷并添加题目
  static async createWithQuestions(req: AuthRequest, res: Response) {
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()

      const { title, description, duration, difficulty, total_score, questions } = req.body

      // 创建试卷
      const [paperResult] = (await connection.execute(
        'INSERT INTO papers (title, description, difficulty, total_score, duration, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
        [title, description, difficulty, total_score, duration]
      )) as [ResultSetHeader, any]

      const paperId = paperResult.insertId

      // 添加题目到试卷
      if (questions && questions.length > 0) {
        const questionValues = questions.map((q: any) => [paperId, q.question_id, q.score, q.order])

        await connection.query('INSERT INTO paper_questions (paper_id, question_id, score, `order`) VALUES ?', [
          questionValues,
        ])
      }

      await connection.commit()

      const successResponse = {
        success: true,
        data: {
          paperId,
          message: '试卷创建成功',
        },
      }

      return res.json(successResponse)
    } catch (error) {
      await connection.rollback()
      console.error('创建试卷错误:', error)
      const errorResponse = {
        success: false,
        error: error instanceof Error ? error.message : '创建试卷失败',
      }
      return res.status(500).json(errorResponse)
    } finally {
      connection.release()
    }
  }
}
