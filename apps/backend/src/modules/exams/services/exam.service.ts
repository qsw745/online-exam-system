// apps/backend/src/modules/exams/services/exam.service.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ExamDetailData } from '../domain/exam.model.js'
import { ExamRepository } from '../repositories/exam.repository.js'
import LogService from '@/modules/logs/services/log.service.js'
import { appLogger } from '@/infrastructure/logging/logger.js'
import { WorkflowService } from '@/modules/workflows/services/workflow.service.js'

let RC: any = null
let RL: any = null
;(async () => {
  try {
    const mod: any = await import('@/common/redis/cache')
    RC = mod?.default ?? mod
  } catch {}
  try {
    const mod: any = await import('@/common/redis/lock')
    RL = mod?.default ?? mod
  } catch {}
})()

const EXAM_TTL = 300
const kExam = (id: number) => `exam:${id}`
const workflowSvc = new WorkflowService()

async function cget<T = any>(k: string) {
  try {
    const v = await RC?.get?.(k)
    return v ? JSON.parse(v) : null
  } catch {
    return null
  }
}
async function cset(k: string, v: any, ttl = EXAM_TTL) {
  try {
    await RC?.set?.(k, JSON.stringify(v), ttl)
  } catch {}
}
async function cdel(...ks: string[]) {
  try {
    for (const k of ks) await RC?.del?.(k)
  } catch {}
}

/** 取“请求作用域”日志器，优先 req.log（由 http-logger 注入），否则退回全局 appLogger */
function getLog(req?: any) {
  const l = req && (req as any).log && typeof (req as any).log.info === 'function' ? (req as any).log : appLogger
  return l
}
function errMeta(e: any) {
  if (e instanceof Error) return { message: e.message, stack: e.stack, name: e.name }
  return { error: e }
}

export class ExamService {
  async list(params: { page: number; limit: number; status?: string; search?: string }) {
    return ExamRepository.list(params)
  }

  async getById(examId: number): Promise<ExamDetailData | null> {
    const ck = kExam(examId)
    const hit = await cget<ExamDetailData>(ck)
    if (hit) return hit
    const data = await ExamRepository.getDetail(examId)
    if (data) await cset(ck, data, 300)
    return data
  }

  async create(userId: number, payload: any) {
    try {
      const workflowConfig = payload?.workflow ?? {}
      const templateId = Number(workflowConfig.template_id ?? workflowConfig.templateId) || undefined
      const requiresReview = Boolean(workflowConfig.requires_review ?? workflowConfig.requiresReview)
      const formValues = workflowConfig.form_values ?? workflowConfig.formValues
      const autoSubmit = Boolean(workflowConfig.auto_submit ?? workflowConfig.autoSubmit)
      const createPayload = {
        ...payload,
        workflow_requires_review: requiresReview,
        workflow_template_id: templateId,
        workflow_form_data: formValues,
      }
      const exam = await ExamRepository.createExam(userId, createPayload)
      const reviewerIds = (workflowConfig.reviewer_ids ?? workflowConfig.reviewerIds ?? payload?.reviewer_ids) as any
      const shouldAutoSubmit = autoSubmit || (Array.isArray(reviewerIds) && reviewerIds.length > 0)
      if (shouldAutoSubmit && templateId) {
        await workflowSvc.submitExamReview({ id: userId } as any, Number(exam.id), {
          template_id: templateId,
          reviewer_ids: Array.isArray(reviewerIds) ? reviewerIds : undefined,
          required_approvals: workflowConfig.required_approvals ?? workflowConfig.requiredApprovals,
          form_values: formValues,
          meta: workflowConfig.meta,
        })
        ;(exam as any).status = 'reviewing'
      }

      await LogService.log({
        type: 'audit',
        userId,
        action: 'create_exam',
        resourceType: 'exam',
        resourceId: Number(exam.id),
        status: 'success',
        message: `创建考试「${exam.title}」成功`,
        details: {
          标题: exam.title,
          描述: exam.description,
          时长分钟: exam.duration,
          开始时间: exam.start_time,
          结束时间: exam.end_time,
          总分: exam.total_score,
          及格分: exam.passing_score,
          题目数量: Array.isArray(payload?.questions) ? payload.questions.length : 0,
        },
      })

      await cdel(kExam(Number(exam.id)))
      return exam
    } catch (e: any) {
      await LogService.log({
        type: 'audit',
        userId,
        action: 'create_exam',
        resourceType: 'exam',
        resourceId: 0,
        status: 'failed',
        level: 'error',
        message: `创建考试失败：${e?.message || '未知错误'}`,
        details: { 提交参数: payload },
      })
      throw e
    }
  }

  async update(userId: number, examId: number, payload: any) {
    try {
      const manualBlocked = new Set(['reviewing', 'approved', 'rejected'])
      if (payload?.status && manualBlocked.has(String(payload.status))) {
        throw new Error('考试状态不可手动设置')
      }
      if (payload?.status === 'published') {
        const current = await ExamRepository.findById(examId)
        if (!current) throw new Error('考试不存在')
        if (current.status !== 'approved') throw new Error('考试尚未审核通过，无法发布')
      }
      const workflowConfig = payload?.workflow ?? {}
      const templateId = Number(workflowConfig.template_id ?? workflowConfig.templateId)
      const formValues = workflowConfig.form_values ?? workflowConfig.formValues
      const requiresReview = workflowConfig.requires_review ?? workflowConfig.requiresReview
      const updatePayload = {
        ...payload,
        workflow_template_id: typeof templateId === 'number' && Number.isFinite(templateId) ? templateId : undefined,
        workflow_form_data: formValues,
        workflow_requires_review: typeof requiresReview === 'boolean' ? requiresReview : undefined,
      }
      const exam = await ExamRepository.updateExam(userId, examId, updatePayload)

      await LogService.log({
        type: 'audit',
        userId,
        action: 'update_exam',
        resourceType: 'exam',
        resourceId: examId,
        status: 'success',
        message: `更新考试「${payload?.title ?? exam.title}」成功`,
        details: {
          新标题: payload?.title ?? exam.title,
          新状态: payload?.status ?? (exam as any)?.status,
          新时长分钟: payload?.duration ?? exam.duration,
          新开始时间: payload?.start_time ?? exam.start_time,
          新结束时间: payload?.end_time ?? exam.end_time,
          新总分: payload?.total_score ?? exam.total_score,
          新及格分: payload?.passing_score ?? exam.passing_score,
          新题目数量: Array.isArray(payload?.questions) ? payload.questions.length : undefined,
        },
      })
      await cdel(kExam(examId))
      return exam
    } catch (e: any) {
      await LogService.log({
        type: 'audit',
        userId,
        action: 'update_exam',
        resourceType: 'exam',
        resourceId: examId,
        status: 'failed',
        level: 'error',
        message: `更新考试失败：${e?.message || '未知错误'}`,
        details: { 提交参数: payload },
      })
      throw e
    }
  }

  async submitReview(userId: number, examId: number, payload: any) {
    const exam = await ExamRepository.findById(examId)
    if (!exam) throw new Error('考试不存在')
    if (exam.created_by !== userId) throw new Error('考试不存在或无权限修改')
    const templateId = Number(payload?.template_id ?? payload?.templateId ?? exam.workflow_template_id)
    const formValues = payload?.form_values ?? payload?.formValues
    await ExamRepository.updateWorkflowFields(examId, userId, {
      templateId: Number.isFinite(templateId) ? templateId : undefined,
      formData: formValues,
      requiresReview: true,
    })
    const data = await workflowSvc.submitExamReview({ id: userId } as any, examId, {
      ...payload,
      template_id: Number.isFinite(templateId) ? templateId : undefined,
      form_values: formValues,
    })
    await cdel(kExam(examId))
    return data
  }

  async remove(userId: number, examId: number) {
    try {
      const existed = await ExamRepository.deleteExam(userId, examId)

      await LogService.log({
        type: 'audit',
        userId,
        action: 'delete_exam',
        resourceType: 'exam',
        resourceId: examId,
        status: 'success',
        message: `删除考试「${existed.title}」成功`,
        details: { 标题: existed.title },
      })
      await cdel(kExam(examId))
    } catch (e: any) {
      await LogService.log({
        type: 'audit',
        userId,
        action: 'delete_exam',
        resourceType: 'exam',
        resourceId: examId,
        status: 'failed',
        level: 'warn',
        message: `删除考试失败：${e?.message || '未知错误'}`,
      })
      throw e
    }
  }

  async start(userId: number, examId: number) {
    try {
      const exam = await ExamRepository.findPublished(examId)
      if (!exam) throw new Error('考试不存在或未发布')

      const now = new Date()
      if (exam.start_time && now < (exam.start_time as any)) throw new Error('考试还未开始')
      if (exam.end_time && now > (exam.end_time as any)) throw new Error('考试已结束')

      const existed = await ExamRepository.findAnyInProgressResult(examId, userId)
      if (existed) throw new Error('您已经开始了这个考试')

      await ExamRepository.createInProgressResult(examId, userId)

      await LogService.log({
        type: 'audit',
        userId,
        action: 'start_exam',
        resourceType: 'exam',
        resourceId: examId,
        status: 'success',
        message: `开始考试「${exam.title}」`,
        details: {
          标题: exam.title,
          开始时间: exam.start_time,
          结束时间: exam.end_time,
        },
      })
    } catch (e: any) {
      await LogService.log({
        type: 'audit',
        userId,
        action: 'start_exam',
        resourceType: 'exam',
        resourceId: examId,
        status: 'failed',
        level: 'warn',
        message: `开始考试失败：${e?.message || '未知错误'}`,
      })
      throw e
    }
  }

  async submit(userId: number, examId: number, answers: Record<number, any>, req: any) {
    const log = getLog(req)
    const doSubmit = async () => {
      const { resultId, questions, totalScore } = await ExamRepository.submitAndScore(examId, userId, answers)

      await LogService.log({
        type: 'audit',
        userId,
        action: 'submit_exam',
        resourceType: 'exam',
        resourceId: examId,
        status: 'success',
        message: `提交考试答卷成功，得分：${totalScore}`,
        details: {
          结果ID: resultId,
          题目数量: questions.length,
          得分: totalScore,
        },
      })

      // —— 事务外联动：错题收集 —— //
      setTimeout(async () => {
        try {
          const { WrongQuestionController } = await import(
            '@/modules/wrong-questions/controllers/wrong-question.controller.js'
          )
          await WrongQuestionController.autoCollectWrongQuestions(
            { ...req, body: { exam_result_id: resultId } } as any,
            { json: () => {}, status: () => ({ json: () => {} }) } as any
          )
        } catch (e) {
          log.error('自动收集错题失败', { module: 'exam.service', action: 'autoCollectWrong', ...errMeta(e) })
        }
      }, 0)

      // —— 事务外联动：学习进度 —— //
      setTimeout(async () => {
        try {
          const mod = await import('@/modules/learning-progress/controllers/learning-progress.controller.js')
          const C = (mod as any).LearningProgressController ?? (mod as any).learningProgressController
          const total = questions.length
          const correct = questions.filter((q: any) => answers[q.id] === q.answer).length
          const studyTime = Math.floor(Math.random() * 60) + 30
          await C.recordProgress(
            {
              user: { id: userId },
              body: { studyTime, questionsAnswered: total, correctAnswers: correct, studyContent: `考试：${examId}` },
            } as any,
            { json: () => {}, status: () => ({ json: () => {} }) } as any
          )
        } catch (e) {
          log.error('记录学习进度失败', { module: 'exam.service', action: 'recordProgress', ...errMeta(e) })
        }
      }, 0)

      // —— 事务外联动：排行榜 —— //
      setTimeout(async () => {
        try {
          const { LeaderboardService } = await import('@/modules/leaderboard/services/leaderboard.service.js')
          const leaderboardService = new LeaderboardService()
          const total = questions.length
          const correct = questions.filter((q: any) => answers[q.id] === q.answer).length
          const accuracy = total > 0 ? (correct / total) * 100 : 0

          const ls: any = leaderboardService as any
          ls.updateLeaderboardRanking?.(1, userId, totalScore) // 总分榜
          ls.updateLeaderboardRanking?.(3, userId, accuracy) // 正确率榜
          ls.checkAndAwardRankingAchievements?.(userId) // 成就发放
        } catch (e) {
          log.error('更新排行榜失败', { module: 'exam.service', action: 'updateLeaderboard', ...errMeta(e) })
        }
      }, 0)

      // 写入后删除缓存
      await cdel(kExam(examId))
      return { score: totalScore, correctCount: undefined }
    }

    const withLock = RL?.withLock as undefined | ((k: string, ttlSec: number, fn: () => Promise<any>) => Promise<any>)
    if (withLock) return withLock(`lock:exam:submit:${examId}:${userId}`, 5, doSubmit)

    try {
      return await doSubmit()
    } catch (e: any) {
      await LogService.log({
        type: 'audit',
        userId,
        action: 'submit_exam',
        resourceType: 'exam',
        resourceId: examId,
        status: 'failed',
        level: 'error',
        message: `提交考试失败：${e?.message || '未知错误'}`,
      })
      getLog(req).error('提交考试失败', { module: 'exam.service', action: 'submit', ...errMeta(e) })
      throw e
    }
  }
}

export default ExamService
