// apps/backend/src/modules/exams/services/paper.service.ts
import type { PaperData, PaperListData } from '../domain/paper.model.js'
import { PaperRepository } from '../repositories/paper.repository.js'
import { WorkflowService } from '@/modules/workflows/services/workflow.service.js'

let RC: any = null
;(async () => {
  try {
    const mod: any = await import('@/common/redis/cache')
    RC = mod?.default ?? mod
  } catch {}
})()

const PAPER_TTL = 600
const kPaper = (id: number) => `paper:${id}`
const kQOfPaper = (id: number) => `paper:${id}:qs`
const workflowSvc = new WorkflowService()

async function cget<T = any>(k: string) {
  try {
    const v = await RC?.get?.(k)
    return v ? JSON.parse(v) : null
  } catch {
    return null
  }
}
async function cset(k: string, v: any, ttl = PAPER_TTL) {
  try {
    await RC?.set?.(k, JSON.stringify(v), ttl)
  } catch {}
}
async function cdel(...ks: string[]) {
  try {
    for (const k of ks) await RC?.del?.(k)
  } catch {}
}

export class PaperService {
  async addQuestion(paperId: number, body: any) {
    const { questionId, score, order } = body
    await cdel(kPaper(paperId), kQOfPaper(paperId))
    return PaperRepository.addQuestion(paperId, { questionId, score, order })
  }

  async removeQuestion(paperId: number, questionId: number) {
    await cdel(kPaper(paperId), kQOfPaper(paperId))
    return PaperRepository.removeQuestion(paperId, questionId)
  }

  async getQuestions(paperId: number) {
    const ck = kQOfPaper(paperId)
    const hit = await cget(ck)
    if (hit) return hit
    const data = await PaperRepository.getQuestions(paperId)
    await cset(ck, data, 600)
    return data
  }

  async updateOrder(paperId: number, orders: Array<{ questionId: number; order: number }>) {
    await cdel(kPaper(paperId), kQOfPaper(paperId))
    await PaperRepository.updateOrder(paperId, orders)
  }

  async list(params: {
    difficulty?: 'easy' | 'medium' | 'hard'
    limit: number
    offset: number
  }): Promise<PaperListData> {
    return PaperRepository.list(params)
  }

  async getById(paperId: number) {
    const ck = kPaper(paperId)
    const hit = await cget(ck)
    if (hit) return hit
    const data = await PaperRepository.findById(paperId)
    await cset(ck, data, 600)
    return data
  }

  async create(body: any): Promise<PaperData> {
    const paper = await PaperRepository.create(body)
    await cdel(kPaper(Number((paper as any)?.id ?? 0)), kQOfPaper(Number((paper as any)?.id ?? 0)))
    return paper
  }

  async update(paperId: number, body: any): Promise<PaperData> {
    const paper = await PaperRepository.update(paperId, body)
    await cdel(kPaper(paperId), kQOfPaper(paperId))
    return paper
  }

  async updateWorkflow(paperId: number, payload: any) {
    await PaperRepository.findById(paperId)
    const requiresReview = payload?.requires_review ?? payload?.workflow_requires_review
    const templateRaw = payload?.template_id ?? payload?.workflow_template_id
    const formValues = payload?.form_values ?? payload?.workflow_form_data
    let templateId: number | null | undefined = undefined
    if (templateRaw === null) {
      templateId = null
    } else if (templateRaw !== undefined && Number.isFinite(Number(templateRaw))) {
      templateId = Number(templateRaw)
    }
    await PaperRepository.updateWorkflowFields(paperId, {
      templateId,
      formData: formValues,
      requiresReview: typeof requiresReview === 'boolean' ? requiresReview : undefined,
    })
    await cdel(kPaper(paperId))
    return { updated: true }
  }

  async submitReview(userId: number, paperId: number, payload: any) {
    const data = await PaperRepository.findById(paperId)
    const paper = data?.paper
    if (!paper) throw new Error('试卷不存在')
    const templateId = Number(payload?.template_id ?? payload?.templateId ?? paper.workflow_template_id)
    const formValues = payload?.form_values ?? payload?.formValues
    const reviewerIds = Array.isArray(payload?.reviewer_ids) ? payload.reviewer_ids : []
    const required = payload?.required_approvals

    await PaperRepository.updateWorkflowFields(paperId, {
      templateId: Number.isFinite(templateId) ? templateId : undefined,
      formData: formValues,
      requiresReview: true,
    })

    const instance = await workflowSvc.startInstance({ id: userId } as any, {
      entity_type: 'paper',
      entity_id: paperId,
      template_id: Number.isFinite(templateId) ? templateId : undefined,
      payload: {
        reviewer_ids: reviewerIds,
        required_approvals: required ?? reviewerIds.length,
        form_values: formValues,
      },
    })

    await cdel(kPaper(paperId))
    return instance
  }

  async remove(paperId: number) {
    const data = await PaperRepository.findById(paperId)
    if (!data?.paper) throw new Error('试卷不存在')
    await workflowSvc.deleteEntityWorkflows('paper', paperId)
    const r = await PaperRepository.remove(paperId)
    await cdel(kPaper(paperId), kQOfPaper(paperId))
    return r
  }

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
      finalPerScore = totalScore ? Math.floor(totalScore / finalCount) : 1
    }

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

    let usedTotal = 0
    const items = candidates.slice(0, finalCount).map((q: any, idx: number) => {
      const isLast = idx === finalCount - 1
      const score = isLast && totalScore ? totalScore - usedTotal : finalPerScore!
      usedTotal += score
      return { question_id: q.id, score, order: idx + 1 }
    })

    const computedTotal = items.reduce((s, it) => s + (it.score || 0), 0)

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

  async addCustomQuestion(
    paperId: number,
    body: {
      type: string
      content: string
      options: string[]
      answer: string
      score: number
      order: number
    }
  ) {
    return PaperRepository.addCustomQuestionSnapshot(paperId, body)
  }
}
