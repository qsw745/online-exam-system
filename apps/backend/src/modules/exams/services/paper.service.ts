// src/modules/exams/services/paper.service.ts
import type { PaperData, PaperListData, PaperQuestionData } from '../domain/paper.model.js'
import { PaperRepository } from '../repositories/paper.repository.js'

export class PaperService {
  async addQuestion(paperId: number, body: any) {
    const { questionId, score, order } = body
    return PaperRepository.addQuestion(paperId, { questionId, score, order })
  }

  async removeQuestion(paperId: number, questionId: number) {
    return PaperRepository.removeQuestion(paperId, questionId)
  }

  async getQuestions(paperId: number): Promise<PaperQuestionData> {
    return PaperRepository.getQuestions(paperId)
  }

  async updateOrder(paperId: number, orders: Array<{ questionId: number; order: number }>) {
    await PaperRepository.updateOrder(paperId, orders)
  }

  async list(params: {
    difficulty?: 'easy' | 'medium' | 'hard'
    limit: number
    offset: number
  }): Promise<PaperListData> {
    return PaperRepository.list(params)
  }

  async getById(paperId: number): Promise<PaperData> {
    return PaperRepository.findById(paperId)
  }

  async create(body: any): Promise<PaperData> {
    return PaperRepository.create(body)
  }

  async update(paperId: number, body: any): Promise<PaperData> {
    return PaperRepository.update(paperId, body)
  }

  async remove(paperId: number) {
    return PaperRepository.remove(paperId)
  }

  /**
   * ✅ 智能组卷服务
   * 入参示例：
   * {
   *   title?: string,
   *   description?: string,
   *   difficulty?: 'easy'|'medium'|'hard',
   *   duration?: number,                 // 默认 60 分钟
   *   total_score?: number,              // 如提供 per_question_score，可计算题量
   *   target_count?: number,             // 或直接指定题量
   *   per_question_score?: number,       // 每题分（可选）
   *   types?: string[]                   // 题型筛选，如 ['single','multiple','judge']
   * }
   */
  async smartGenerate(body: any) {
    const title = (body?.title ?? '').toString().trim() || '智能组卷'
    const description = (body?.description ?? '').toString().trim() || ''
    const difficulty = body?.difficulty as 'easy' | 'medium' | 'hard' | undefined
    const duration = Number.isFinite(Number(body?.duration)) ? Number(body?.duration) : 60
    const totalScore = Number.isFinite(Number(body?.total_score)) ? Number(body?.total_score) : undefined
    const targetCount = Number.isFinite(Number(body?.target_count)) ? Number(body?.target_count) : undefined
    const perScore = Number.isFinite(Number(body?.per_question_score)) ? Number(body?.per_question_score) : undefined
    const types = Array.isArray(body?.types) ? (body.types as string[]) : undefined

    if (!targetCount && !totalScore) {
      const err: any = new Error('必须提供 target_count 或 total_score')
      err.code = 'BAD_REQUEST'
      throw err
    }
    let finalCount = targetCount ?? 0
    let finalPerScore = perScore

    if (!finalCount && totalScore && perScore) {
      finalCount = Math.floor(totalScore / perScore)
    }
    if (!finalCount || finalCount <= 0) {
      const err: any = new Error('无法确定题量，请提供 target_count 或 total_score + per_question_score')
      err.code = 'BAD_REQUEST'
      throw err
    }
    if (!finalPerScore) {
      // 若没提供每题分，按总分平均分配（向下取整，余数加到最后一道题）
      finalPerScore = totalScore ? Math.floor(totalScore / finalCount) : 1
    }

    // 拉取随机题
    const candidates = await PaperRepository.findRandomQuestions({
      types,
      difficulty,
      limit: finalCount,
    })

    if (!candidates.length || candidates.length < finalCount) {
      const err: any = new Error(`题库数量不足，需要 ${finalCount} 道，实际仅 ${candidates.length} 道`)
      err.code = 'NOT_ENOUGH_QUESTIONS'
      throw err
    }

    // 分数分配：最后一道题吃掉余数，确保总分精确
    let usedTotal = 0
    const items = candidates.slice(0, finalCount).map((q, idx) => {
      const isLast = idx === finalCount - 1
      const score = isLast && totalScore
          ? (totalScore - usedTotal)
          : finalPerScore!
      usedTotal += score
      return { question_id: q.id, score, order: idx + 1 }
    })

    // 计算最终总分（如果没传 totalScore 就用分配结果相加）
    const computedTotal = items.reduce((s, it) => s + (it.score || 0), 0)

    // 事务创建试卷 + 关联题目
    const result = await PaperRepository.createPaperAndAttachQuestions({
      title,
      description,
      difficulty: difficulty ?? 'medium',
      duration,
      total_score: computedTotal,
      questions: items,
    })

    return {
      paperId: result.paperId,
      title,
      total_score: computedTotal,
      duration,
      count: finalCount,
    }
  }

  async createWithQuestions(body: any) {
    return PaperRepository.createWithQuestions(body)
  }
    async searchBank(params: {
        page: number
        limit: number
        search?: string
        difficulty?: 'easy' | 'medium' | 'hard'
        type?: 'single_choice' | 'multiple_choice' | 'true_false' | string
    }) {
        return PaperRepository.searchBank(params)
    }

    async addCustomQuestion(paperId: number, body: {
        type: string
        content: string
        options: string[]
        answer: string
        score: number
        order: number
    }) {
        return PaperRepository.addCustomQuestionSnapshot(paperId, body)
    }
}
