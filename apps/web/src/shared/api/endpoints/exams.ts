// src/shared/api/endpoints/exams.ts
import { api } from '../core/httpClient'

/** ===== Types ===== */
export type OptionItem = string | { content: string }
export type QuestionType = 'single' | 'multiple' | 'true_false' | 'short_answer'
export type ExamStatus = 'draft' | 'published' | 'archived'

export interface Question {
  id: string
  content: string
  options: OptionItem[]
  type: QuestionType
  difficulty?: 'easy' | 'medium' | 'hard'
  knowledge_points?: string[]
}

export interface ExamSummary {
  id: number
  title: string
  description?: string
  duration: number
  total_score: number
  status: ExamStatus
  start_time?: string
  end_time?: string
  question_count?: number
  participant_count?: number
  created_at?: string
  updated_at?: string
}

export interface ExamPaper {
  id: string
  title: string
  description?: string
  duration: number // minutes
  total_score: number
  questions: Question[]
}

export interface ExamListParams {
  page?: number
  limit?: number
  search?: string
  status?: ExamStatus | 'all'
}

export interface ExamListResult {
  items: ExamSummary[]
  total: number
  page: number
  limit: number
}

/** ===== Helpers: 兼容不同后端返回结构 ===== */
function pickList(res: any): ExamListResult {
  // 兼容：
  // 1) { exams, total, page, limit }
  // 2) { data: { exams, total, page, limit } }
  // 3) { data: [...] }
  const d = res?.data ?? {}
  const payload = d.data ?? d

  if (Array.isArray(payload)) {
    return { items: payload as ExamSummary[], total: payload.length, page: 1, limit: payload.length }
  }

  const items =
    payload.exams ?? payload.items ?? payload.list ?? (Array.isArray(payload.data) ? payload.data : []) ?? []

  return {
    items: items as ExamSummary[],
    total: Number(payload.total ?? items.length ?? 0),
    page: Number(payload.page ?? 1),
    limit: Number(payload.limit ?? items.length ?? 10),
  }
}

function pickPaper(res: any): ExamPaper | null {
  // 兼容：
  // 1) { exam: {...} } / { paper: {...} }
  // 2) { data: { exam | paper } }
  // 3) 直接返回试卷对象
  const d = res?.data
  if (!d) return null
  const p = d.exam ?? d.paper ?? d.data?.exam ?? d.data?.paper ?? d.data ?? d
  if (p && p.id && Array.isArray(p.questions)) return p as ExamPaper
  return null
}

/** ===== Endpoints ===== */
export const exams = {
  /** 列表（带分页/筛选），返回统一结构 */
  async list(params: ExamListParams = {}): Promise<ExamListResult> {
    const res = await api.get('/exams', { params })
    return pickList(res)
  },

  /** 兼容旧方法：保持签名不变；返回原始响应（如你仍有地方直接用 res.data） */
  getAll: () => api.get('/exams'),

  /** 获取试卷详情（/exams/:id）；返回强类型对象或 null */
  async getById(id: string): Promise<ExamPaper | null> {
    const res = await api.get(`/exams/${id}`)
    return pickPaper(res)
  },

  /** 部分业务是“任务 -> 试卷”，优先 /tasks/:id/exam，失败再回退 /exams/:id */
  async getTaskPaper(taskId: string): Promise<ExamPaper | null> {
    const res = await api.get(`/tasks/${taskId}/exam`).catch(() => api.get(`/exams/${taskId}`))
    return pickPaper(res)
  },

  /** CRUD */
  create: (examData: any) => api.post('/exams', examData),
  update: (id: string, examData: any) => api.put(`/exams/${id}`, examData),
  delete: (id: string) => api.delete(`/exams/${id}`),

  /** 交卷（保持原有签名），返回 resultId/true */
  async submit(taskId: string, submitData: { answers: Record<string, number[]>; time_spent: number }) {
    const res = await api.post(`/tasks/${taskId}/submit`, submitData)
    const d = res?.data
    return d?.resultId ?? d?.id ?? true
  },
}

export type { ExamPaper as TExamPaper, ExamSummary as TExamSummary }
export default exams
