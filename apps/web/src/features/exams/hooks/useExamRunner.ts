// src/features/exams/hooks/useExamRunner.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { App } from 'antd'
import { exams } from '@shared/api/endpoints/exams'
import type { ExamPaper } from '../types'

export function useExamRunner(taskId: string) {
  const { message } = App.useApp()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [exam, setExam] = useState<ExamPaper | null>(null)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number[]>>({})
  const [timeLeft, setTimeLeft] = useState(0) // 秒
  const [flagged, setFlagged] = useState<Set<number>>(new Set())
  const timerRef = useRef<number | null>(null)

  const storageKey = `exam:${taskId}`

  // 恢复草稿
  useEffect(() => {
    const raw = localStorage.getItem(storageKey)
    if (raw) {
      try {
        const d = JSON.parse(raw)
        setAnswers(d.answers ?? {})
        setIndex(d.index ?? 0)
      } catch {}
    }
  }, [storageKey])

  // 自动保存草稿
  useEffect(() => {
    const id = window.setInterval(() => {
      localStorage.setItem(storageKey, JSON.stringify({ answers, index }))
    }, 8000)
    return () => window.clearInterval(id)
  }, [answers, index, storageKey])

  // 拉取试卷
  const load = useCallback(async () => {
    try {
      setLoading(true)
      const paper = await exams.getTaskPaper(taskId)
      if (!paper || !paper.duration || !Array.isArray(paper.questions) || paper.questions.length === 0) {
        message.error('考试数据无效')
        setExam(null)
        return
      }
      setExam(paper)
      setTimeLeft(paper.duration * 60)
    } catch (e) {
      console.error(e)
      message.error('加载试卷失败')
      setExam(null)
    } finally {
      setLoading(false)
    }
  }, [message, taskId])

  useEffect(() => {
    load()
  }, [load])

  // 倒计时
  useEffect(() => {
    if (!timeLeft || loading) return
    timerRef.current = window.setInterval(() => {
      setTimeLeft(prev => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [timeLeft, loading])

  // 时间到自动提交
  useEffect(() => {
    if (timeLeft === 0 && !loading && exam && !submitting) {
      void submit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft])

  const current = useMemo(() => exam?.questions?.[index], [exam, index])
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers])

  const setAnswer = (qid: string, opts: number[]) => {
    setAnswers(prev => ({ ...prev, [qid]: opts }))
  }

  const toggleFlag = (i: number) => {
    setFlagged(prev => {
      const n = new Set(prev)
      n.has(i) ? n.delete(i) : n.add(i)
      return n
    })
  }

  const next = () => setIndex(i => Math.min(i + 1, (exam?.questions.length || 1) - 1))
  const prev = () => setIndex(i => Math.max(i - 1, 0))

  const submit = useCallback(async () => {
    if (!exam || submitting) return
    setSubmitting(true)
    try {
      const time_spent = exam.duration * 60 - timeLeft
      await exams.submitTask(taskId, { answers, time_spent })
      // 成功后清理草稿
      localStorage.removeItem(storageKey)
      return true
    } catch (e: any) {
      console.error(e)
      message.error('提交答案失败')
      return false
    } finally {
      setSubmitting(false)
    }
  }, [answers, exam, message, submitting, taskId, timeLeft, storageKey])

  return {
    // state
    loading,
    submitting,
    exam,
    index,
    current,
    answers,
    flagged,
    timeLeft,
    answeredCount,
    // actions
    setAnswer,
    toggleFlag,
    next,
    prev,
    submit,
  }
}
