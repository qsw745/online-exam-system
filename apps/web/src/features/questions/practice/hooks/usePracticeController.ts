// features/questions/practice/hooks/usePracticeController.ts
import { useCallback, useRef, useState } from 'react'
import { message } from 'antd'
import { favoritesApi as rawFavoritesApi, isSuccess, questionsApi, wrongQuestions } from '@/shared/api/http'
import { translate } from '@/shared/utils/i18n'

const favoritesApi: any = rawFavoritesApi as any

// 最小可用类型
type QuestionRaw = any
export type NormalizedQuestion = {
  id: string
  content?: string
  options?: Array<{ content: string; is_correct?: boolean }>
  type: 'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer' | string
}

function normalizeQuestion(raw: QuestionRaw): NormalizedQuestion {
  const opts =
    Array.isArray(raw?.options) &&
    raw.options.map((o: any) => ({
      content: o?.content ?? o?.text ?? '',
      is_correct: !!(o?.is_correct ?? o?.correct),
    }))

  return {
    id: String(raw?.id ?? raw?.question_id ?? ''),
    content: raw?.content ?? raw?.title ?? '',
    options: Array.isArray(opts) ? opts : undefined,
    type: raw?.question_type ?? raw?.type ?? 'single_choice',
  }
}

export type PracticeFilters = {
  type?: string
  difficulty?: string
  search?: string
}

export function usePracticeController() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [question, setQuestion] = useState<NormalizedQuestion | null>(null)
  const [favorited, setFavorited] = useState(false)

  // 连续模式
  const [mode, setMode] = useState<'single' | 'continuous'>('single')
  const [filters, setFilters] = useState<PracticeFilters>({})
  const [ids, setIds] = useState<string[]>([])
  const [index, setIndex] = useState(0)

  // 并发防抖
  const reqNoRef = useRef(0)

  const initContinuous = useCallback(async (f: PracticeFilters, currentId?: string) => {
    setMode('continuous')
    setFilters(f)
    setLoading(true)
    setError(null)
    try {
      let practiced: number[] = []
      try {
        const r = await wrongQuestions.getPracticedQuestions()
        if (isSuccess<any>(r as any)) {
          const d = (r as any).data as any
          practiced = Array.isArray(d) ? d : d?.ids ?? []
        }
      } catch {}

      const params: any = { limit: 100, page: 1 }
      if (f.type) params.type = f.type
      if (f.difficulty) params.difficulty = f.difficulty
      if (f.search) params.search = f.search

      const res = await questionsApi.list(params)
      if (!isSuccess(res as any)) throw new Error(translate('auto.c1c65b92dc'))
      const raw = (res as any).data as any
      const all = Array.isArray(raw) ? raw : raw?.questions ?? []
      const pool = (all.length ? all : []).filter((q: any) => !practiced.includes(+q.id)).map((q: any) => String(q.id))
      const shuffled = [...(pool.length ? pool : all.map((q: any) => String(q.id)))].sort(() => Math.random() - 0.5)

      setIds(shuffled)
      const startId = currentId && shuffled.includes(currentId) ? currentId : shuffled[0]
      setIndex(Math.max(0, shuffled.indexOf(startId)))
      return startId
    } catch (e: any) {
      setError(e?.message || '初始化练习失败')
      message.error(translate('auto.506fe6687b'))
      setIds([])
      setIndex(0)
      return undefined
    }
  }, [])

  const loadQuestion = useCallback(async (qid: string) => {
    const myReq = ++reqNoRef.current
    try {
      setLoading(true)
      setError(null)
      const r: any = await questionsApi.getById(qid)
      if (!isSuccess(r as any)) throw new Error((r as any)?.error || '加载题目失败')
      if (myReq !== reqNoRef.current) return

      const raw: any = (r?.data as any)?.question ?? r?.data ?? r
      const norm = normalizeQuestion(raw)
      setQuestion(norm)

      // 收藏状态（可选）
      try {
        const fav = await (favoritesApi?.checkQuestion?.(norm.id) ?? Promise.resolve(null))
        if (fav && isSuccess(fav as any)) setFavorited(!!fav.data?.is_favorited)
      } catch {}
    } catch (e: any) {
      if (myReq !== reqNoRef.current) return
      setError(e?.message || '加载题目失败')
    } finally {
      if (myReq === reqNoRef.current) setLoading(false)
    }
  }, [])

  const toggleFavorite = useCallback(async () => {
    if (!question) return
    try {
      if (favorited) {
        const r = await (favoritesApi?.remove?.(question.id) ?? Promise.resolve({ success: true }))
        if (!isSuccess(r as any)) throw new Error((r as any).error || '取消收藏失败')
        setFavorited(false)
        message.success(translate('auto.0fc87e8309'))
      } else {
        const r = await (favoritesApi?.add?.(question.id, (question.content || '').slice(0, 100)) ??
          Promise.resolve({ success: true }))
        if (!isSuccess(r as any)) throw new Error((r as any).error || '收藏失败')
        setFavorited(true)
        message.success(translate('auto.143a521b56'))
      }
    } catch (e: any) {
      message.error(e?.message || translate('app.operation_failed'))
    }
  }, [question, favorited])

  const record = useCallback(async (qid: string, correct: boolean, payload: any) => {
    try {
      await wrongQuestions.recordPractice({ question_id: parseInt(qid, 10), is_correct: correct, answer: payload })
    } catch {}
  }, [])

  return {
    // data
    loading,
    error,
    question,
    favorited,
    toggleFavorite,
    // mode & list
    mode,
    filters,
    ids,
    index,
    setIndex,
    initContinuous,
    loadQuestion,
    record,
  }
}
