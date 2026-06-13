// apps/backend/src/modules/wrong-questions/services/wrong-question.service.ts
import type { MasteryLevel, PracticeRecord, WrongQuestion, WrongQuestionBook } from '../domain/wq.model'
import { WrongQuestionRepository } from '../repositories/wq.repository.js'

export class WrongQuestionService {
  constructor(private readonly repo = new WrongQuestionRepository()) {}

  // books
  createBook(data: Omit<WrongQuestionBook, 'id' | 'created_at' | 'updated_at'>) {
    return this.repo.createBook(data)
  }
  getUserBooks(userId: number) {
    return this.repo.getBooksWithStats(userId)
  }
  updateBook(bookId: number, userId: number, patch: Partial<WrongQuestionBook>) {
    return this.repo.updateBook(bookId, userId, patch)
  }
  deleteBook(bookId: number, userId: number) {
    return this.repo.deleteBookCascade(bookId, userId)
  }

  // questions
  /** ✅ 显式要求带上 user_id */
  async addWrongQuestion(data: Omit<WrongQuestion, 'id' | 'created_at' | 'updated_at'>) {
    return this.repo.upsertWrongQuestion(data)
  }

  async getWrongQuestions(
      bookId: number,
      userId: number,
      options: { page?: number; limit?: number; mastery_level?: string; tags?: string; search?: string }
  ) {
    const ok = await this.repo.ensureBookOwnership(bookId, userId)
    if (!ok) throw new Error('无权访问此错题本')
    const page = Math.max(1, options.page || 1)
    const limit = Math.min(100, options.limit || 20)
    const { rows, total } = await this.repo.listWrongQuestions(bookId, { ...options, page, limit })
    return { questions: rows, total }
  }

  async updateWrongQuestion(id: number, _userId: number, patch: Partial<WrongQuestion>) {
    return this.repo.updateWrongQuestion(id, patch)
  }

  removeWrongQuestion(id: number, _userId: number) {
    return this.repo.removeWrongQuestionCascade(id)
  }

  // practice
  async addPracticeRecord(data: Omit<PracticeRecord, 'id' | 'created_at'>) {
    const id = await this.repo.addPracticeRecord(data)
    // 更新 mastery（近 5 次全对 -> mastered；近 3 次全对 -> partially_mastered）
    const flags = await this.repo.recentCorrectFlags(data.wrong_question_id, 5)
    let level: MasteryLevel = 'not_mastered'
    if (flags.length >= 5 && flags.every(Boolean)) level = 'mastered'
    else if (flags.slice(0, 3).every(Boolean)) level = 'partially_mastered'
    await this.repo.setMasteryLevel(data.wrong_question_id, level)
    return id
  }

  // share
  shareBook(bookId: number, userId: number, opts: { shared_to?: number; is_public: boolean; expires_at?: string }) {
    return this.repo.makeShare(bookId, userId, opts)
  }
  getSharedBook(shareCode: string, userId: number) {
    return this.repo.getShare(shareCode, userId)
  }

  // statistics
  getStatistics(userId: number) {
    return this.repo.statistics(userId)
  }

  // collect from exam result
  getWrongQuestionsFromExamResult(examResultId: number) {
    return this.repo.collectFromExamResult(examResultId)
  }

  // batch helpers
  /** ✅ 批量添加也需要 userId，用于写入 user_id */
  async batchAddWrongQuestions(userId: number, bookId: number, questionIds: number[], examResultId?: number) {
    const success: number[] = []
    const failed: { questionId: number; error: string }[] = []
    for (const qid of questionIds) {
      try {
        await this.addWrongQuestion({
          user_id: userId,
          book_id: bookId,
          question_id: qid,
          exam_result_id: examResultId,
          wrong_count: 1,
          last_wrong_time: new Date(),
          mastery_level: 'not_mastered',
          tags: '',
          notes: '',
        })
        success.push(qid)
      } catch (e: any) {
        failed.push({ questionId: qid, error: e?.message || '未知错误' })
      }
    }
    return { success, failed }
  }
}
