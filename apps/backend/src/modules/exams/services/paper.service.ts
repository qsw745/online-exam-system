// src/modules/exams/services/paper.service.ts
import type { IPaper, IPaperQuestion, PaperData, PaperListData, PaperQuestionData } from '../domain/paper.model.js'
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

  /** 智能组卷（保留你的 TODO，或把原逻辑粘进来） */
  async smartGenerate(_body: any) {
    throw new Error('TODO: 将原 smartGenerate 逻辑搬入这里（如需我现在也能帮你迁完）')
  }

  async createWithQuestions(body: any) {
    return PaperRepository.createWithQuestions(body)
  }
}
