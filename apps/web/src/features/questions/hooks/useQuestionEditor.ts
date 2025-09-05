// features/questions/hooks/useQuestionEditor.ts
import { useCallback, useEffect, useMemo, useState } from 'react'
import { message } from 'antd'
import { useLocation, useParams, useNavigate } from 'react-router-dom'
import { questionsApi } from '../api'
import { buildPayload, normalizeFromServer } from '../utils/question-normalize'
import type { OptionDTO, QuestionType } from '../types/question'

export function useQuestionEditor() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()

  const mode: 'create' | 'view' | 'edit' = useMemo(() => {
    if (!id) return 'create'
    return /\/(question-edit|questions\/[^/]+\/edit)\b/i.test(location.pathname) ? 'edit' : 'view'
  }, [id, location.pathname])

  const isView = mode === 'view'
  const isEdit = mode === 'edit'

  const [initialLoading, setInitialLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [allTags, setAllTags] = useState<string[]>([])

  // 表单状态
  const [content, setContent] = useState('')
  const [type, setType] = useState<QuestionType>('single_choice')
  const [options, setOptions] = useState<OptionDTO[]>([
    { content: '', is_correct: false },
    { content: '', is_correct: false },
  ])
  const [answer, setAnswer] = useState('')
  const [explanation, setExplanation] = useState('')
  const [knowledgePoints, setKnowledgePoints] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])

  const fetchTags = useCallback(async () => {
    try {
      const res = await (questionsApi as any).getTags?.()
      if (res?.success && Array.isArray(res.data)) setAllTags(res.data)
    } catch {}
  }, [])

  const loadDetail = useCallback(async () => {
    if (!id) return
    setInitialLoading(true)
    try {
      const res = await questionsApi.getById(id)
      if (!res?.success) return message.error(res?.message || '获取题目详情失败')
      const q = normalizeFromServer(res.data)
      setContent(q.content)
      setType(q.question_type)
      setExplanation(q.explanation || '')
      setKnowledgePoints(q.knowledge_points || [])
      setTags(Array.isArray(q.tags) ? q.tags : [])
      setOptions(q.options ?? [])
      // 判断 & 简答的答案
      if (q.question_type === 'true_false')
        setAnswer(Array.isArray(q.correct_answer) && q.correct_answer[0] === 0 ? 'true' : 'false')
      else if (q.question_type === 'short_answer') setAnswer((q as any).answer || '')
      else setAnswer('')
    } catch (e: any) {
      message.error(e?.message || '获取题目详情失败')
    } finally {
      setInitialLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchTags()
  }, [fetchTags])
  useEffect(() => {
    if (id) loadDetail()
  }, [id, loadDetail])

  const addOption = () => setOptions(prev => [...prev, { content: '', is_correct: false }])
  const removeOption = (index: number) =>
    setOptions(prev => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)))
  const changeOption = (index: number, patch: Partial<OptionDTO>) =>
    setOptions(prev => {
      const next = [...prev]
      const merged = { ...next[index], ...patch }
      // 单选只能一个正确
      if (patch.is_correct && type === 'single_choice')
        next.forEach((o, i) => (next[i] = { ...o, is_correct: i === index }))
      next[index] = merged
      return next
    })

  const submit = async () => {
    if (!content.trim()) return message.error('请输入题目内容')

    if (type === 'single_choice' || type === 'multiple_choice') {
      if (options.some(o => !o.content.trim())) return message.error('选项内容不能为空')
      if (!options.some(o => o.is_correct)) return message.error('请至少选择一个正确选项')
    }
    if (type === 'true_false' && !answer) return message.error('请选择正确答案')
    if (type === 'short_answer' && !answer.trim()) return message.error('请输入参考答案')

    try {
      setLoading(true)
      const payload = buildPayload({
        content,
        type,
        options,
        answer,
        explanation,
        knowledgePoints,
        tags,
        score: 10,
      })
      const res = isEdit && id ? await questionsApi.update(id, payload) : await questionsApi.create(payload)
      if (!res?.success) return message.error(res?.message || (isEdit ? '题目更新失败' : '题目创建失败'))
      message.success(isEdit ? '题目更新成功' : '题目创建成功')
      navigate('/admin/questions')
    } catch (e: any) {
      message.error(e?.message || (isEdit ? '更新题目失败' : '创建题目失败'))
    } finally {
      setLoading(false)
    }
  }

  return {
    // 模式
    mode,
    isView,
    isEdit,
    // 加载
    initialLoading,
    loading,
    // 表单状态 & 操作
    content,
    setContent,
    type,
    setType,
    options,
    addOption,
    removeOption,
    changeOption,
    answer,
    setAnswer,
    explanation,
    setExplanation,
    knowledgePoints,
    setKnowledgePoints,
    tags,
    setTags,
    allTags,
    // 提交
    submit,
  }
}
