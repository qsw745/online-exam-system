import { App } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMatch, useNavigate, useParams } from 'react-router-dom'
import { papersApi, type Paper, type PaperDifficulty } from '../endpoints/papers'

type Mode = 'create' | 'view' | 'edit'

export function usePaperEditor() {
  const { id } = useParams()
  const matchView = useMatch('/paper-detail/:id')
  const matchEdit = useMatch('/paper-edit/:id')
  const mode: Mode = matchView ? 'view' : matchEdit ? 'edit' : 'create'

  const navigate = useNavigate()
  const { message } = App.useApp()

  // 加载 & 提交状态
  const [loading, setLoading] = useState<boolean>(mode !== 'create')
  const [submitting, setSubmitting] = useState(false)

  // 字段
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [totalScore, setTotalScore] = useState(100)
  const [duration, setDuration] = useState(60)
  const [difficulty, setDifficulty] = useState<PaperDifficulty>('medium')
  const [questions, setQuestions] = useState<any[]>([])

  const isView = mode === 'view'
  const isEdit = mode === 'edit'

  const load = useCallback(async () => {
    if (!id) return setLoading(false)
    try {
      setLoading(true)
      const p = await papersApi.getById(id)
      if (!p) {
        message.error('获取试卷详情失败')
        navigate('/admin/papers')
        return
      }
      setTitle(p.title ?? '')
      setDescription(p.description ?? '')
      setTotalScore(p.total_score ?? 100)
      setDuration(p.duration ?? 60)
      setDifficulty((p.difficulty ?? 'medium') as PaperDifficulty)

      // 题目
      if (Array.isArray(p.questions)) {
        setQuestions(p.questions)
      } else {
        const qs = await papersApi.getQuestions(id)
        setQuestions(Array.isArray(qs) ? qs : [])
      }
    } catch (e) {
      console.error(e)
      message.error('获取试卷详情失败')
      navigate('/admin/papers')
    } finally {
      setLoading(false)
    }
  }, [id, message, navigate])

  useEffect(() => {
    if (mode !== 'create') void load()
  }, [mode, load])

  const pageTitle = useMemo(() => (isView ? '查看试卷' : isEdit ? '编辑试卷' : '创建试卷'), [isView, isEdit])
  const pageDesc = useMemo(
    () => (isView ? '查看试卷详细信息' : isEdit ? '编辑试卷信息' : '创建一个新的试卷'),
    [isView, isEdit]
  )

  const submit = async () => {
    if (isView) return
    if (!title.trim()) return message.error('请输入试卷标题')

    const payload: Omit<Paper, 'id' | 'created_at' | 'updated_at' | 'questions'> = {
      title: title.trim(),
      description: description.trim(),
      total_score: Number(totalScore) || 100,
      duration: Math.max(1, Number(duration) || 60),
      difficulty,
    }

    try {
      setSubmitting(true)
      if (isEdit && id) {
        await papersApi.update(id, payload)
        message.success('试卷更新成功')
      } else {
        await papersApi.create(payload)
        message.success('试卷创建成功')
      }
      navigate('/admin/papers')
    } catch (e) {
      console.error(e)
      message.error('保存试卷失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return {
    // mode
    isView,
    isEdit,
    pageTitle,
    pageDesc,

    // state
    loading,
    submitting,
    title,
    description,
    totalScore,
    duration,
    difficulty,
    questions,

    // setters
    setTitle,
    setDescription,
    setTotalScore,
    setDuration,
    setDifficulty,

    // actions
    submit,
  }
}
