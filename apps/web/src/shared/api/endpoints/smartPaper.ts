// features/smart-paper/endpoints/smartPaper.ts
import { api } from '@/shared/api/http'

export type Difficulty = 'easy' | 'medium' | 'hard' | 'mixed'
export type QTypeKey = 'single_choice' | 'multiple_choice' | 'true_false' | 'fill_blank' | 'essay'

export interface Question {
  id: number
  content: string
  question_type: string
  difficulty: string
  score: number
  knowledge_points?: string[]
}

export interface SmartPaperConfig {
  title: string
  description: string
  duration: number
  difficulty: Difficulty
  totalQuestions: number
  totalScore: number
  questionTypes: Record<QTypeKey, number>
  difficultyDistribution: { easy: number; medium: number; hard: number }
  knowledgePoints: string[]
}

/** 统一提取 data，容错不同后端包裹结构 */
const pickData = <T>(resp: any, fallback: T): T => {
  const d = resp?.data ?? resp
  if (d?.data !== undefined) return d.data as T
  return (d as T) ?? fallback
}

export const smartPaperApi = {
  async getKnowledgePoints(): Promise<string[]> {
    const resp = await api.get('/questions/knowledge-points')
    const list = pickData<string[] | { items?: string[] }>(resp, [])
    return Array.isArray(list) ? list : list?.items ?? []
  },

  /**
   * 发送智能组卷请求：
   * - 将 camelCase 配置映射为后端期望的 snake_case 字段
   * - 提供 target_count、total_score、per_question_score，避免 400
   * - 兼容两种返回：1) {questions: Question[]} 2) {paperId,...}（直接创建完成）
   */
  async generate(
    cfg: SmartPaperConfig
  ): Promise<
    | { type: 'preview'; questions: Question[] }
    | { type: 'created'; paperId: number; total_score: number; count: number; duration: number; title: string }
  > {
    // 题型列表（只把数量>0的类型传给后端作为筛选）
    const types = (Object.keys(cfg.questionTypes) as QTypeKey[])
      .filter(k => (cfg.questionTypes[k] || 0) > 0)
      .map(k => k)

    const payload: any = {
      title: cfg.title,
      description: cfg.description,
      duration: cfg.duration,
      // 后端期望 difficulty: 'easy'|'medium'|'hard'，mixed 交给后端默认（不传）
      ...(cfg.difficulty !== 'mixed' ? { difficulty: cfg.difficulty } : {}),

      // ✅ 关键：按后端需要提供 target_count/total_score/per_question_score
      target_count: cfg.totalQuestions,
      total_score: cfg.totalScore,
      // 均分到每题（向下取整，余数由后端在最后一题调整）
      per_question_score:
        cfg.totalQuestions > 0 ? Math.max(1, Math.floor(cfg.totalScore / cfg.totalQuestions)) : undefined,

      // 可选参考信息（后端可忽略）
      types, // ['single_choice', ...]
      knowledge_points: cfg.knowledgePoints,
      difficulty_distribution: cfg.difficultyDistribution,
    }

    const resp = await api.post('/papers/smart-generate', payload)
    const d = pickData<any>(resp, {})

    // 形态 1：题目数组（预览）
    if (Array.isArray(d?.questions)) {
      const arr: Question[] = d.questions
      return { type: 'preview', questions: arr }
    }
    // 形态 2：已创建（返回 paperId）
    if (typeof d?.paperId === 'number') {
      return {
        type: 'created',
        paperId: d.paperId,
        total_score: d.total_score ?? cfg.totalScore,
        count: d.count ?? cfg.totalQuestions,
        duration: d.duration ?? cfg.duration,
        title: d.title ?? cfg.title,
      }
    }
    // 容错：有些服务直接返回数组
    if (Array.isArray(d)) {
      return { type: 'preview', questions: d as Question[] }
    }
    // 都不匹配时给个空预览
    return { type: 'preview', questions: [] }
  },

  /** 仍保留“预览后创建”的接口（当后端不直接创建时使用） */
  async createWithQuestions(payload: {
    title: string
    description: string
    duration: number
    difficulty: 'easy' | 'medium' | 'hard'
    total_score: number
    questions: { question_id: number; score: number; order: number }[]
  }) {
    return api.post('/papers/create-with-questions', payload)
  },
}

export default smartPaperApi
