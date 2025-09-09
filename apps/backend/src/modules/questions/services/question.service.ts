// apps/backend/src/modules/questions/services/question.service.ts
import type { IQuestion, QuestionData, QuestionListData } from '../domain/question.model'
import { QuestionRepository } from '../repositories/question.repository'
import { LogService } from '@modules/analytics/services/log.service'

const logger = new LogService()

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
  if (input != null && (typeof input === 'number' || typeof input === 'boolean')) return [String(input)]
  return []
}

export class QuestionService {
  async list(params: {
    question_type?: IQuestion['question_type']
    difficulty?: IQuestion['difficulty']
    search?: string
    tags?: string[]
    page: number
    limit: number
  }): Promise<QuestionListData> {
    const { question_type, difficulty, search, tags = [], page, limit } = params
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
    if (tags.length > 0) {
      for (const t of tags) {
        conditions.push(`JSON_CONTAINS(tags, JSON_QUOTE(?))`)
        values.push(t)
      }
    }
    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const [rows, total] = await Promise.all([
      QuestionRepository.list(whereSql, values, limit, offset),
      QuestionRepository.count(whereSql, values),
    ])

    // 解析 JSON 字段
    const parsed = rows.map(q => {
      try {
        if (q.options && typeof q.options === 'string') q.options = JSON.parse(q.options)
        if (q.knowledge_points && typeof q.knowledge_points === 'string')
          q.knowledge_points = JSON.parse(q.knowledge_points)
        if (q.tags && typeof q.tags === 'string') q.tags = JSON.parse(q.tags)
      } catch {}
      return q
    })

    return {
      questions: parsed,
      pagination: { total, totalPages: Math.ceil(total / limit), currentPage: page, pageSize: limit },
    }
  }

  async getById(id: number): Promise<QuestionData> {
    const q = await QuestionRepository.findById(id)
    if (!q) throw new Error('问题不存在')
    try {
      if (q.options && typeof q.options === 'string') q.options = JSON.parse(q.options)
      if (q.knowledge_points && typeof q.knowledge_points === 'string')
        q.knowledge_points = JSON.parse(q.knowledge_points)
      if (q.tags && typeof q.tags === 'string') q.tags = JSON.parse(q.tags)
    } catch {}
    return { question: q }
  }

  async create(
    user: { id?: number; username?: string } | undefined,
    body: any,
    reqMeta?: { ip?: string; ua?: string }
  ): Promise<QuestionData> {
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
    } = body

    if (!content || !question_type || correct_answer === undefined)
      throw new Error('缺少必填字段：题目内容、题目类型和正确答案')

    const validTypes = ['single_choice', 'multiple_choice', 'true_false', 'short_answer']
    const validDifficulties = ['easy', 'medium', 'hard']
    if (!validTypes.includes(question_type)) throw new Error('无效的题目类型')
    if (!validDifficulties.includes(difficulty)) throw new Error('无效的难度等级')

    let optionsJson: string | null = null
    if (question_type === 'single_choice' || question_type === 'multiple_choice') {
      if (!Array.isArray(options) || options.length === 0) throw new Error('选择题必须提供选项')
      optionsJson = JSON.stringify(options)
    }

    const correctAnswerStr = typeof correct_answer === 'string' ? correct_answer : JSON.stringify(correct_answer)
    const knowledgePointsStr = JSON.stringify(ensureArrayFromMaybeCsv(knowledge_points))
    const tagsStr = JSON.stringify(ensureArrayFromMaybeCsv(tags))
    const questionTitle = title || (content.length > 50 ? content.substring(0, 50) + '...' : content)

    const id = await QuestionRepository.insert({
      title: questionTitle,
      content,
      question_type,
      options: optionsJson,
      correct_answer: correctAnswerStr,
      knowledge_points: knowledgePointsStr,
      tags: tagsStr,
      explanation: explanation || '',
      difficulty,
      exam_id,
      score,
    })

    // 记录操作日志
    await logger.logUserAction({
      userId: user?.id || 0,
      username: user?.username,
      action: 'create_question',
      resourceType: 'question',
      resourceId: id,
      details: { questionType: question_type, title: questionTitle, difficulty, tags: ensureArrayFromMaybeCsv(tags) },
      ipAddress: reqMeta?.ip,
      userAgent: reqMeta?.ua,
    } as any)

    const q = await QuestionRepository.findById(id)
    return { question: q! }
  }

  async update(
    user: { id?: number; username?: string } | undefined,
    id: number,
    body: any,
    reqMeta?: { ip?: string; ua?: string }
  ): Promise<QuestionData> {
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
    } = body

    const sets: string[] = []
    const vals: any[] = []
    if (title !== undefined) {
      sets.push('title = ?')
      vals.push(title)
    }
    if (content !== undefined) {
      sets.push('content = ?')
      vals.push(content)
    }
    if (question_type !== undefined) {
      sets.push('question_type = ?')
      vals.push(question_type)
    }
    if (options !== undefined) {
      sets.push('options = ?')
      vals.push(options == null ? null : JSON.stringify(options))
    }
    if (correct_answer !== undefined) {
      sets.push('correct_answer = ?')
      vals.push(typeof correct_answer === 'string' ? correct_answer : JSON.stringify(correct_answer))
    }
    if (knowledge_points !== undefined) {
      sets.push('knowledge_points = ?')
      vals.push(JSON.stringify(ensureArrayFromMaybeCsv(knowledge_points)))
    }
    if (tags !== undefined) {
      sets.push('tags = ?')
      vals.push(JSON.stringify(ensureArrayFromMaybeCsv(tags)))
    }
    if (explanation !== undefined) {
      sets.push('explanation = ?')
      vals.push(explanation || '')
    }
    if (difficulty !== undefined) {
      sets.push('difficulty = ?')
      vals.push(difficulty)
    }
    if (exam_id !== undefined) {
      sets.push('exam_id = ?')
      vals.push(exam_id ?? null)
    }
    if (score !== undefined) {
      sets.push('score = ?')
      vals.push(Number(score))
    }

    if (!sets.length) throw new Error('没有需要更新的字段')
    const affected = await QuestionRepository.update(id, sets, vals)
    if (!affected) throw new Error('问题不存在')

    await logger.logUserAction({
      userId: user?.id || 0,
      username: user?.username,
      action: 'update_question',
      resourceType: 'question',
      resourceId: id,
      details: { updatedFields: sets, questionId: id },
      ipAddress: reqMeta?.ip,
      userAgent: reqMeta?.ua,
    } as any)

    const q = await QuestionRepository.findById(id)
    return { question: q! }
  }

  async remove(
    user: { id?: number; username?: string } | undefined,
    id: number,
    reqMeta?: { ip?: string; ua?: string }
  ) {
    const affected = await QuestionRepository.delete(id)
    if (!affected) throw new Error('问题不存在')
    await logger.logUserAction({
      userId: user?.id || 0,
      username: user?.username,
      action: 'delete_question',
      resourceType: 'question',
      resourceId: id,
      details: { questionId: id },
      ipAddress: reqMeta?.ip,
      userAgent: reqMeta?.ua,
    } as any)
    return null
  }

  async bulkImport(
    user: { id?: number; username?: string } | undefined,
    body: any,
    query: any,
    reqMeta?: { ip?: string; ua?: string }
  ) {
    const { questions } = body
    if (!questions || !Array.isArray(questions) || questions.length === 0) throw new Error('请提供有效的题目数据')
    if (questions.length > 1000) throw new Error('单次导入题目数量不能超过1000道')

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

        const tagsRaw = (q as any).tags ?? (q as any)['标签'] ?? (q as any).tag ?? (q as any).Tags
        const knowledgeRaw = (q as any).knowledge_points ?? (q as any)['知识点'] ?? (q as any)['知識點']

        let optionsJson: string | null = null
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

        const dupId = await QuestionRepository.findDup(content, question_type)
        if (dupId) {
          const doUpsert = query.upsert === 'true' || body?.upsert === true
          if (doUpsert) {
            await QuestionRepository.update(
              dupId,
              ['tags=?', 'knowledge_points=?', 'explanation=?', 'score=?', 'difficulty=?'],
              [tagsStr, knowledgePointsStr, explanation || '', score, difficulty]
            )
            successCount++
          } else {
            failCount++
            errors.push(`第${i + 1}题：题目已存在，跳过导入`)
          }
          continue
        }

        const questionTitle = title || (content.length > 50 ? content.substring(0, 50) + '...' : content)
        await QuestionRepository.insert({
          title: questionTitle,
          content,
          question_type,
          options: optionsJson,
          correct_answer: correctAnswerStr,
          knowledge_points: knowledgePointsStr,
          tags: tagsStr,
          explanation: explanation || '',
          difficulty,
          exam_id: null,
          score,
        })
        successCount++
      } catch (e: any) {
        failCount++
        errors.push(`第${i + 1}题导入失败：${e?.message || '未知错误'}`)
      }
    }

    await logger.logUserAction({
      userId: user?.id || 0,
      username: user?.username,
      action: 'bulk_import_questions',
      resourceType: 'question',
      details: { totalQuestions: questions.length, successCount, failCount, errorCount: errors.length },
      ipAddress: reqMeta?.ip,
      userAgent: reqMeta?.ua,
    } as any)

    return { success_count: successCount, fail_count: failCount, errors }
  }

  // practice & wrong questions
  async recordPractice(userId: number, body: { question_id: number; is_correct: boolean; answer: any }) {
    const { question_id, is_correct, answer } = body
    await QuestionRepository.insertPractice(userId, question_id, is_correct, answer)
    if (!is_correct) {
      const existed = await QuestionRepository.selectWrong(userId, question_id)
      if (existed.length > 0) await QuestionRepository.incWrong(userId, question_id)
      else await QuestionRepository.insertWrong(userId, question_id)
    } else {
      const existed = await QuestionRepository.selectWrong(userId, question_id)
      if (existed.length > 0) {
        await QuestionRepository.incCorrect(userId, question_id)
        const count = await QuestionRepository.selectCorrectCount(userId, question_id)
        if (count >= 3) await QuestionRepository.setMastered(userId, question_id)
      }
    }
  }

  async listWrong(userId: number, page: number, limit: number, mastered?: boolean) {
    let where = 'WHERE wq.user_id = ?'
    const vals: any[] = [userId]
    if (mastered !== undefined) {
      where += ' AND wq.is_mastered = ?'
      vals.push(mastered ? 1 : 0)
    }
    const total = await QuestionRepository.countWrong(where, vals)
    const rows = await QuestionRepository.listWrong(where, vals, limit, (page - 1) * limit)
    return {
      wrongQuestions: rows,
      pagination: { total, totalPages: Math.ceil(total / limit), currentPage: page, pageSize: limit },
    }
  }

  async markAsMastered(userId: number, questionId: number) {
    await QuestionRepository.setMastered(userId, questionId)
  }

  async removeFromWrong(userId: number, questionId: number) {
    await QuestionRepository.removeWrong(userId, questionId)
  }

  async stats(userId: number) {
    const s = await QuestionRepository.stats(userId)
    const rate = s.totalPractice > 0 ? ((s.correct / s.totalPractice) * 100).toFixed(1) : '0.0'
    return {
      totalPractice: s.totalPractice,
      correctRate: rate,
      wrongQuestions: s.wrong,
      masteredQuestions: s.mastered,
    }
  }

  async practicedIds(userId: number) {
    return QuestionRepository.practicedIds(userId)
  }

  async tags() {
    return QuestionRepository.tagsAgg()
  }

  async knowledgePoints() {
    return QuestionRepository.knowledgeAgg()
  }
}
