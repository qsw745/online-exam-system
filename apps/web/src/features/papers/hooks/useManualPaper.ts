import { App } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { questionsApi, type Question } from '../endpoints/questions'
import { papersApi } from '../endpoints/papers'

type Difficulty = 'easy' | 'medium' | 'hard'

export function useManualPaper() {
  const { message } = App.useApp()
  const navigate = useNavigate()

  // 列表 & 过滤
  const [loading, setLoading] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([])
  const [keyword, setKeyword] = useState('')
  const [type, setType] = useState('all')
  const [difficultyFilter, setDifficultyFilter] = useState('all')

  // 选择
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // 试卷信息
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState(60)
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')

  // 总分（memo）
  const totalScore = useMemo(() => {
    if (!questions.length || !selectedIds.size) return 0
    const selected = new Set(selectedIds)
    return questions.reduce((sum, q) => sum + (selected.has(q.id) ? q.score : 0), 0)
  }, [questions, selectedIds])

  // 防抖拉取
  const timer = useRef<number | null>(null)
  const load = useCallback(async () => {
    try {
      setLoading(true)
      const params = {
        keyword: keyword || undefined,
        type: type === 'all' ? undefined : type,
        difficulty: difficultyFilter === 'all' ? undefined : difficultyFilter,
      }
      const list = await questionsApi.list(params)
      setQuestions(list)
    } catch (e: any) {
      console.error(e)
      message.error(e?.message || '加载题目失败，请重试')
      setQuestions([])
    } finally {
      setLoading(false)
    }
  }, [keyword, type, difficultyFilter, message])

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => load(), 250) as unknown as number
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [load])

  // 选择/移除
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // 提交创建
  const createPaper = async () => {
    if (!title.trim()) return message.error('请输入试卷标题')
    if (!selectedIds.size) return message.error('请至少选择一道题目')

    try {
      setLoading(true)
      await papersApi.createWithQuestions({
        title: title.trim(),
        description: description.trim(),
        duration: Math.max(1, Number(duration) || 60),
        difficulty,
        total_score: totalScore,
        question_ids: Array.from(selectedIds),
      })
      message.success('试卷创建成功')
      navigate('/admin/papers')
    } catch (e: any) {
      console.error(e)
      message.error(e?.response?.data?.message || e?.message || '创建试卷失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return {
    // state
    loading,
    questions,
    selectedIds,
    keyword,
    type,
    difficultyFilter,
    title,
    description,
    duration,
    difficulty,
    totalScore,

    // setters
    setKeyword,
    setType,
    setDifficultyFilter,
    setTitle,
    setDescription,
    setDuration,
    setDifficulty,

    // actions
    toggleSelect,
    createPaper,
  }
}
