// features/smart-paper/hooks/useSmartPaper.ts
import { App } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { smartPaperApi, type Question, type SmartPaperConfig } from '../endpoints/smartPaper'

export type Step = 'config' | 'preview'

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

  const generate = useCallback(async () => {
    if (validationError) {
      message.error(validationError)
      return
    }
    setGenerating(true)
    try {
      const qs = await smartPaperApi.generate(config)
      setQuestions(qs)
      setStep('preview')
      message.success('智能组卷成功！')
    } catch (e: any) {
      message.error(e?.response?.data?.error || e?.message || '智能组卷失败')
    } finally {
      setGenerating(false)
    }
  }, [config, message, validationError])

  const save = useCallback(
    async (onOk?: () => void) => {
      setLoading(true)
      try {
        const payload = {
          title: config.title,
          description: config.description,
          duration: config.duration,
          difficulty: config.difficulty === 'mixed' ? 'medium' : config.difficulty,
          total_score: config.totalScore,
          questions: questions.map((q, i) => ({ question_id: q.id, score: q.score, order: i + 1 })),
        }
        const resp = await smartPaperApi.createWithQuestions(payload)
        if ((resp as any)?.success === false) throw new Error((resp as any)?.message || '创建试卷失败')
        message.success('试卷创建成功！')
        onOk?.()
      } catch (e: any) {
        message.error(e?.response?.data?.error || e?.message || '创建试卷失败')
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
