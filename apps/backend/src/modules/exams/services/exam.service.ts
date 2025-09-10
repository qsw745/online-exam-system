// src/modules/exams/services/exam.service.ts
import { LogRepository } from '@/modules/logs/repositories/log.repository.js'
import type { ExamDetailData } from '../domain/exam.model.js'
import { ExamRepository } from '../repositories/exam.repository.js'

export class ExamService {
  async list(params: { page: number; limit: number; status?: string; search?: string }) {
    return ExamRepository.list(params)
  }

  async getById(examId: number): Promise<ExamDetailData> {
    return ExamRepository.getDetail(examId)
  }

  async create(userId: number, payload: any) {
    const exam = await ExamRepository.createExam(userId, payload)
    await LogRepository.insertAuditLog({
      userId,
      username: undefined,
      action: 'create_exam',
      resourceType: 'exam',
      resourceId: Number(exam.id),
      details: { title: exam.title, duration: exam.duration, questionCount: payload?.questions?.length || 0 },
    } as any)
    return exam
  }

  async update(userId: number, examId: number, payload: any) {
    const exam = await ExamRepository.updateExam(userId, examId, payload)
    await LogRepository.insertAuditLog({
      userId,
      action: 'update_exam',
      resourceType: 'exam',
      resourceId: examId,
      details: {
        title: payload?.title ?? exam.title,
        status: payload?.status,
        questionCount: payload?.questions?.length,
      },
    } as any)
    return exam
  }

  async remove(userId: number, examId: number) {
    const existed = await ExamRepository.deleteExam(userId, examId)
    await LoggerService.logUserAction({
      userId,
      action: 'delete_exam',
      resourceType: 'exam',
      resourceId: examId,
      details: { examTitle: existed.title },
    } as any)
  }

  async start(userId: number, examId: number) {
    const exam = await ExamRepository.findPublished(examId)
    if (!exam) throw new Error('考试不存在或未发布')
    const now = new Date()
    if (exam.start_time && now < (exam.start_time as any)) throw new Error('考试还未开始')
    if (exam.end_time && now > (exam.end_time as any)) throw new Error('考试已结束')

    const existed = await ExamRepository.findAnyInProgressResult(examId, userId)
    if (existed) throw new Error('您已经开始了这个考试')

    await ExamRepository.createInProgressResult(examId, userId)
  }

  async submit(userId: number, examId: number, answers: Record<number, any>, req: any) {
    const { resultId, questions, totalScore } = await ExamRepository.submitAndScore(examId, userId, answers)

    // —— 事务外的联动（与原实现一致）——
    setTimeout(async () => {
      try {
        const { WrongQuestionController } = await import('../wrong-questions/wrong-question.controller.js')
        await WrongQuestionController.autoCollectWrongQuestions(
          { ...req, body: { exam_result_id: resultId } } as any,
          { json: () => {}, status: () => ({ json: () => {} }) } as any
        )
      } catch (e) {
        console.error('自动收集错题失败:', e)
      }
    }, 0)

    setTimeout(async () => {
      try {
        const mod = await import('@/modules/learning-progress/controllers/learning-progress.controller.js')
        const C = (mod as any).LearningProgressController ?? (mod as any).learningProgressController
        const total = questions.length
        const correct = questions.filter(q => answers[q.id] === q.answer).length
        const studyTime = Math.floor(Math.random() * 60) + 30
        await C.recordProgress(
          {
            user: { id: userId },
            body: { studyTime, questionsAnswered: total, correctAnswers: correct, studyContent: `考试：${examId}` },
          } as any,
          { json: () => {}, status: () => ({ json: () => {} }) } as any
        )
      } catch (e) {
        console.error('记录学习进度失败:', e)
      }
    }, 0)

    setTimeout(async () => {
      try {
        const { LeaderboardService } = await import('@/modules/leaderboard/services/leaderboard.service.js')
        const leaderboardService = new LeaderboardService()
        const total = questions.length
        const correct = questions.filter(q => answers[q.id] === q.answer).length
        const accuracy = total > 0 ? (correct / total) * 100 : 0
        await leaderboardService.updateLeaderboardRanking(1, userId, totalScore)
        await leaderboardService.updateLeaderboardRanking(3, userId, accuracy)
        await leaderboardService.checkAndAwardRankingAchievements(userId)
      } catch (e) {
        console.error('更新排行榜失败:', e)
      }
    }, 0)
  }
}
