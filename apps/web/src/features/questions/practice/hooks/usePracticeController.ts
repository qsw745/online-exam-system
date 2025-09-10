// features/questions/practice/hooks/usePracticeController.ts
import { useCallback, useRef, useState } from 'react'
import { message } from 'antd'
import {
  favorites as favoritesApi,
  isSuccess,
  questions as questionsApi,
  wrongQuestions,
  type ApiResult,
} from '@/shared/api/http'
import type { NormalizedQuestion, QuestionRaw } from '../types/question'
import { normalizeQuestion } from '../utils/question-normalize'
import type { PracticeFilters } from '../utils/url'

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
        if (isSuccess<any>(r)) {
          const d = r.data as any
          practiced = Array.isArray(d) ? d : d?.ids ?? []
        }
      } catch {}

      const params: any = { limit: 100, page: 1 }
      if (f.type) params.type = f.type
      if (f.difficulty) params.difficulty = f.difficulty
      if (f.search) params.search = f.search

      const res = await questionsApi.list(params)
      if (!isSuccess(res)) throw new Error('获取题目失败')
      const raw = res.data as any
      const all = Array.isArray(raw) ? raw : raw?.questions ?? []
      const pool = (all.length ? all : []).filter((q: any) => !practiced.includes(+q.id)).map((q: any) => String(q.id))
      const shuffled = [...(pool.length ? pool : all.map((q: any) => String(q.id)))].sort(() => Math.random() - 0.5)

      setIds(shuffled)
      const startId = currentId && shuffled.includes(currentId) ? currentId : shuffled[0]
      setIndex(Math.max(0, shuffled.indexOf(startId)))
      return startId
    } catch (e: any) {
      setError(e?.message || '初始化练习失败')
      message.error('初始化练习失败')
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
      const r: ApiResult<any> = await questionsApi.getById(qid)
      if (!isSuccess(r)) throw new Error((r as any).error || '加载题目失败')
      if (myReq !== reqNoRef.current) return

      const raw: QuestionRaw = (r.data as any)?.question ?? (r.data as any)
      const norm = normalizeQuestion(raw)
      setQuestion(norm)

      // 收藏状态
      try {
        const fav = await favoritesApi.checkQuestion(norm.id)
        if (isSuccess(fav)) setFavorited(!!fav.data?.is_favorited)
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
        const r = await favoritesApi.remove(question.id)
        if (!isSuccess(r)) throw new Error((r as any).error || '取消收藏失败')
        setFavorited(false)
        message.success('已取消收藏')
      } else {
        const r = await favoritesApi.add(question.id, (question.content || '').slice(0, 100))
        if (!isSuccess(r)) throw new Error((r as any).error || '收藏失败')
        setFavorited(true)
        message.success('已添加到收藏')
      }
    } catch (e: any) {
      message.error(e?.message || '操作失败')
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
