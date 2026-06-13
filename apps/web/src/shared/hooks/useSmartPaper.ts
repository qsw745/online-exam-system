// features/smart-paper/hooks/useSmartPaper.ts
import { App } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { smartPaperApi, type Question, type SmartPaperConfig } from '@/shared/api/endpoints/smartPaper'

export type Step = 'config' | 'preview'

type GenerateResult =
  | { status: 'ok'; mode: 'preview' }
  | {
      status: 'ok'
      mode: 'created'
      paperId: number
      total_score: number
      count: number
      duration: number
      title: string
    }
  | { status: 'error'; message?: string }

export function useSmartPaper(initial?: Partial<SmartPaperConfig>) {
  const { message } = App.useApp()
  const [step, setStep] = useState<Step>('config')
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([])
  const [knowledgePoints, setKnowledgePoints] = useState<string[]>([])

  const [config, setConfig] = useState<SmartPaperConfig>({
    title: '',
    description: '',
    duration: 60,
    difficulty: 'mixed',
    totalQuestions: 20,
    totalScore: 100,
    questionTypes: { single_choice: 10, multiple_choice: 5, true_false: 3, fill_blank: 2, essay: 0 },
    difficultyDistribution: { easy: 30, medium: 50, hard: 20 },
    knowledgePoints: [],
    ...initial,
  })

  useEffect(() => {
    smartPaperApi
      .getKnowledgePoints()
      .then(setKnowledgePoints)
      .catch(() => {})
  }, [])

  const setField = useCallback(<K extends keyof SmartPaperConfig>(k: K, v: SmartPaperConfig[K]) => {
    setConfig(prev => ({ ...prev, [k]: v }))
  }, [])

  const setQType = useCallback((k: keyof SmartPaperConfig['questionTypes'], v: number) => {
    setConfig(prev => ({ ...prev, questionTypes: { ...prev.questionTypes, [k]: Math.max(0, v || 0) } }))
  }, [])

  const setDiffPct = useCallback((k: keyof SmartPaperConfig['difficultyDistribution'], v: number) => {
    setConfig(prev => ({
      ...prev,
      difficultyDistribution: { ...prev.difficultyDistribution, [k]: Math.max(0, v || 0) },
    }))
  }, [])

  const validationError = useMemo(() => {
    if (!config.title.trim()) return '请输入试卷标题'
    if (config.totalQuestions <= 0) return '题目总数必须大于0'
    if (config.totalScore <= 0) return '总分必须大于0'
    const sumQ = Object.values(config.questionTypes).reduce((a, b) => a + b, 0)
    if (sumQ !== config.totalQuestions) return `题型分布总数(${sumQ})需等于题目总数(${config.totalQuestions})`
    const pct = Object.values(config.difficultyDistribution).reduce((a, b) => a + b, 0)
    if (Math.abs(pct - 100) > 0.1) return `难度分布总和必须为100%（当前 ${pct}%）`
    return null
  }, [config])

  useEffect(() => {
    setConfig(prev => {
      const total = prev.totalQuestions
      const sum = Object.values(prev.questionTypes).reduce((a, b) => a + b, 0)
      if (total <= 0 || sum === total) return prev
      const entries = Object.entries(prev.questionTypes)
      if (!entries.length) {
        return {
          ...prev,
          questionTypes: { single_choice: total, multiple_choice: 0, true_false: 0, fill_blank: 0, essay: 0 },
        }
      }
      const ratio = total / (sum || 1)
      let allocated = 0
      const normalized = entries.reduce<Record<string, number>>((acc, [key, value], idx) => {
        if (idx === entries.length - 1) {
          acc[key] = Math.max(0, total - allocated)
        } else {
          const next = Math.max(0, Math.round((value || 0) * ratio))
          acc[key] = next
          allocated += next
        }
        return acc
      }, {})
      const finalSum = Object.values(normalized).reduce((a, b) => a + b, 0)
      if (finalSum !== total) {
        const [firstKey] = Object.keys(normalized)
        if (firstKey) normalized[firstKey] = Math.max(0, normalized[firstKey] + (total - finalSum))
      }
      return { ...prev, questionTypes: normalized as SmartPaperConfig['questionTypes'] }
    })
  }, [config.totalQuestions])

  /**
   * 智能生成：
   * - 若服务返回 {questions:[]} → 进入预览步骤
   * - 若服务直接返回 {paperId,...} → 直接创建完成（返回给上层决定跳转）
   */
  const generate = useCallback(async (): Promise<GenerateResult> => {
    if (validationError) {
      message.error(validationError)
      return { status: 'error' }
    }
    setGenerating(true)
    try {
      const result = await smartPaperApi.generate(config)
      if (result.type === 'preview') {
        setQuestions(result.questions || [])
        setStep('preview')
        if ((result.questions || []).length) {
          message.success('智能组卷成功，已生成预览！')
        } else {
          message.warning('没有生成题目，请调整筛选条件后重试')
        }
        return { status: 'ok', mode: 'preview' }
      } else {
        // 直接创建成功，由上层决定跳到详情页
        message.success('智能组卷成功，试卷已创建！')
        return {
          status: 'ok',
          mode: 'created',
          paperId: result.paperId,
          total_score: result.total_score,
          count: result.count,
          duration: result.duration,
          title: result.title,
        }
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.response?.data?.error || e?.message || '智能组卷失败'
      message.error(msg)
      return { status: 'error', message: msg }
    } finally {
      setGenerating(false)
    }
  }, [config, message, validationError])

  /** 预览模式：保存为试卷 */
  const save = useCallback(
    async (onOk?: () => void) => {
      setLoading(true)
      try {
        const payload = {
          title: config.title,
          description: config.description,
          duration: config.duration,
          difficulty: config.difficulty === 'mixed' ? 'medium' : (config.difficulty as 'easy' | 'medium' | 'hard'),
          total_score: config.totalScore,
          questions: questions.map((q, i) => ({
            question_id: q.id,
            score: q.score ?? Math.max(1, Math.floor(config.totalScore / Math.max(1, config.totalQuestions))),
            order: i + 1,
          })),
        }
        const resp = await smartPaperApi.createWithQuestions(payload)
        const ok = (resp as any)?.success ?? ((resp as any)?.status >= 200 && (resp as any)?.status < 300)
        if (!ok) throw new Error((resp as any)?.message || '创建试卷失败')
        message.success('试卷创建成功！')
        onOk?.()
      } catch (e: any) {
        const msg = e?.response?.data?.message || e?.response?.data?.error || e?.message || '创建试卷失败'
        message.error(msg)
      } finally {
        setLoading(false)
      }
    },
    [config, questions, message]
  )

  return {
    // state
    step,
    setStep,
    config,
    setField,
    setQType,
    setDiffPct,
    knowledgePoints,
    questions,
    // flags
    loading,
    generating,
    validationError,
    // actions
    generate,
    save,
  }
}
