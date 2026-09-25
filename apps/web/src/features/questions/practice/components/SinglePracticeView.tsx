// src/features/questions/practice/components/SinglePracticeView.tsx
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Heart,
  HeartOff,
  SkipForward,
  Sparkles,
} from 'lucide-react'
import { Button, Card, Checkbox, Radio, Space, Spin, Tag, Typography, App, Alert, Input } from 'antd'
import { wrongQuestions } from '@/shared/api/http'
import {
  getQuestionById,
  isQuestionFavorited,
  addQuestionToFavorites,
  removeQuestionFromFavorites,
} from '@/features/questions/practice/utils/practiceApi'
import { aiApi } from '@/shared/api/endpoints/ai'
import { judgePracticeQuestion, parsePracticeGrade, type PracticeQuestion } from '../utils/practiceQuestion'
import { translate } from '@/shared/utils/i18n'

const { Title, Text } = Typography
const { TextArea } = Input

type Question = PracticeQuestion

type Props = {
  ids: string[]
  startIndex: number
  onExit: () => void
  onIndexChange?: (index: number) => void
  onNextPage?: () => boolean | void
  hasNextPage?: boolean
  navigationBusy?: boolean
}

const SHORT_ANSWER_PASS_RATE = 0.6
const SHORT_ANSWER_MAX_SCORE = 10

export default function SinglePracticeView({
  ids,
  startIndex,
  onExit,
  onIndexChange,
  onNextPage,
  hasNextPage,
  navigationBusy = false,
}: Props) {
  const { message } = App.useApp()
  const generation = useRef(0)
  const submitLock = useRef(false)
  const explainLock = useRef(false)
  const favoriteLock = useRef(false)
  const favoriteVersion = useRef(0)
  const [favoriteLoading, setFavoriteLoading] = useState(false)
  const [recordError, setRecordError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [index, setIndex] = useState(startIndex)
  const qid = ids[index]
  const cacheRef = useRef<Map<string, Question>>(new Map())

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState<Question | null>(null)

  const [selected, setSelected] = useState<number[]>([])
  const [text, setText] = useState('')
  const [answered, setAnswered] = useState(false)
  const [correct, setCorrect] = useState(false)
  const [showExp, setShowExp] = useState(false)
  const [fav, setFav] = useState(false)
  const [aiExp, setAiExp] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [gradeLoading, setGradeLoading] = useState(false)
  const [gradeDetail, setGradeDetail] = useState<{ score: number; maxScore: number; feedback?: string } | null>(null)

  useLayoutEffect(() => {
    generation.current += 1
    submitLock.current = false
    explainLock.current = false
    favoriteLock.current = false
    return () => { generation.current += 1 }
  }, [qid])

  // 加载题目
  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!qid) { setError('没有可练习的题目，请返回列表'); setQ(null); return }
      try {
        setLoading(true)
        setError(null)
        setQ(null)
        setFav(false)
        setAiLoading(false)
        setGradeLoading(false)
        setFavoriteLoading(false)
        setRecordError(null)
        let data = cacheRef.current.get(qid)
        if (!data) {
          const fetched = (await getQuestionById(qid)) as Question | undefined
          if (!fetched) throw new Error(translate('auto.a51a5ae17e'))
          cacheRef.current.set(qid, fetched as Question)
          data = fetched as Question
        }
        if (!mounted) return
        setQ(data)
        setSelected([])
        setText('')
        setAnswered(false)
        setCorrect(false)
        setShowExp(false)
        setAiExp(null)
        setGradeDetail(null)
        const favoriteReadVersion = favoriteVersion.current
        void isQuestionFavorited(qid).then(f => { if (mounted && favoriteReadVersion === favoriteVersion.current) setFav(f) }).catch(() => undefined)
      } catch (e: any) {
        if (mounted) setError(e?.message || '加载题目失败')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [qid, retry])

  useEffect(() => {
    setIndex(startIndex)
  }, [startIndex, ids])

  useEffect(() => {
    if (typeof onIndexChange === 'function') onIndexChange(index)
  }, [index, onIndexChange])

  const progress = useMemo(() => `${index + 1} / ${ids.length}`, [index, ids.length])

  const submit = async () => {
    if (!q || answered || submitLock.current || loading) return
    if (q.question_type === 'short_answer' ? !text.trim() : !selected.length) return
    const version = generation.current
    submitLock.current = true
    setGradeLoading(true)
    setRecordError(null)
    try {
      let ok = judgePracticeQuestion(q, selected)
      if (q.question_type === 'short_answer') {
        const res: any = await aiApi.gradeShortAnswer({ question: q.content, rubric: q.correct_answer,
          answer: text, max_score: SHORT_ANSWER_MAX_SCORE })
        if (version !== generation.current) return
        if (!res?.success) throw new Error(res?.error || 'AI 评分失败')
        const detail = parsePracticeGrade(res.data?.data ?? res.data, SHORT_ANSWER_MAX_SCORE)
        ok = detail.score >= detail.maxScore * SHORT_ANSWER_PASS_RATE
        setGradeDetail(detail)
      }
      if (version !== generation.current) return
      setCorrect(ok)
      setAnswered(true)
      setShowExp(true)
      try {
        const result = await wrongQuestions.recordPractice({ question_id: Number(q.id), is_correct: ok,
          answer: q.question_type === 'short_answer' ? text : selected })
        if (!result.success) throw new Error(result.error || '练习记录未确认')
      } catch {
        if (version === generation.current) setRecordError('本次练习记录尚未确认，答题结果保留在当前页面。请稍后查看学习记录。')
      }
    } catch (error) {
      if (version === generation.current) message.error(error instanceof Error ? error.message : '评分失败，请重试')
    } finally {
      if (version === generation.current) {
        submitLock.current = false
        setGradeLoading(false)
      }
    }
  }

  const goPrev = () => { if (!navigationBusy) setIndex(i => Math.max(0, i - 1)) }
  const goNext = () => {
    if (navigationBusy) return
    if (index + 1 < ids.length) { setIndex(index + 1); return }
    if (hasNextPage && onNextPage) { onNextPage(); return }
    onExit()
  }

  const toggleFavorite = async () => {
    if (!q || favoriteLock.current) return
    const version = generation.current
    favoriteVersion.current += 1
    favoriteLock.current = true
    setFavoriteLoading(true)
    try {
      if (fav) await removeQuestionFromFavorites(String(q.id))
      else await addQuestionToFavorites(String(q.id), q.content.slice(0, 100))
      if (version !== generation.current) return
      setFav(!fav)
      message.success(translate(fav ? 'auto.0fc87e8309' : 'auto.143a521b56'))
    } catch (error) {
      if (version === generation.current) message.error(error instanceof Error ? error.message : '收藏操作失败')
    } finally {
      if (version === generation.current) { favoriteLock.current = false; setFavoriteLoading(false) }
    }
  }

  const typeLabel = (t?: string) =>
    (({ single_choice: translate('questions.single_choice'), multiple_choice: translate('questions.multiple_choice'), true_false: translate('questions.judge'), short_answer: translate('questions.type_short') } as any)[t || ''] || t)

  const diffLabel = (d?: string) =>
    (({ easy: translate('questions.easy'), medium: translate('questions.medium'), hard: translate('questions.hard') } as any)[d || ''] || d)

  const requestAiExplain = async () => {
    if (!q || explainLock.current) return
    const version = generation.current
    explainLock.current = true
    setAiLoading(true)
    try {
      const payload = {
        question_type: q.question_type,
        content: q.content,
        options: q.options,
        correct_answer: q.correct_answer,
        user_answer: q.question_type === 'short_answer' ? text : selected,
      }
      const res: any = await aiApi.explainQuestion(payload)
      if (version !== generation.current) return
      if (!res?.success) throw new Error(res?.error || 'AI 解析失败')
      const root = res?.data ?? {}
      const data = root?.data ?? root
      const exp = data?.explanation || data?.raw || ''
      if (exp) {
        setAiExp(exp)
        setShowExp(true)
      } else {
        message.warning(translate('auto.7d03e91106'))
      }
    } catch (e: any) {
      if (version === generation.current) message.error(e?.message || translate('auto.c740b0c5d5'))
    } finally {
      if (version === generation.current) { explainLock.current = false; setAiLoading(false) }
    }
  }

  const isLast = index === ids.length - 1

  return (
    <div className="student-practice-session" style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div className="practice-session-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button icon={<ArrowLeft size={16} />} onClick={onExit}>
              {translate('papers.back_to_list')}</Button>
            {!!ids.length && <Tag color="blue">{translate('auto.960bcbcd93')}{progress}</Tag>}
          </Space>
          <Space className="practice-session-actions" wrap>
            <Button icon={<ChevronLeft size={16} />} onClick={goPrev} disabled={navigationBusy || index === 0}>
              {translate('exam.previous')}</Button>
            <Button
              icon={<SkipForward size={16} />}
              onClick={goNext}
              disabled={navigationBusy}
              style={{ color: '#fa8c16', borderColor: '#fa8c16' }}
            >
              {translate('auto.31a98593f1')}</Button>
            <Button type="primary" onClick={goNext} disabled={navigationBusy}>
              {isLast && hasNextPage ? translate('visible.67a246a344') : translate('exam.next')} <ChevronRight size={16} />
            </Button>
            <Button
              icon={fav ? <Heart size={16} /> : <HeartOff size={16} />}
              onClick={toggleFavorite}
              loading={favoriteLoading}
              disabled={!q || loading}
              danger={fav}
              type={fav ? 'primary' : 'default'}
            >
              {fav ? translate('visible.2d2cdabf29') : translate('header.favorites')}
            </Button>
            <Button
              icon={showExp ? <EyeOff size={16} /> : <Eye size={16} />}
              onClick={() => setShowExp(v => !v)}
              type="primary"
              ghost
            >
              {showExp ? translate('visible.fbdfb3c5b1') : translate('visible.716d473a0a')}
            </Button>
            {import.meta.env.VITE_AI_ENABLED !== 'false' && (
              <Button icon={<Sparkles size={16} />} onClick={requestAiExplain} loading={aiLoading} disabled={!q}>
                {translate('auto.710dba6721')}
              </Button>
            )}
          </Space>
        </div>

        {recordError && <Alert type="warning" showIcon message={recordError} />}
        <Spin spinning={loading} tip={translate('questions.loading')}>
          {!loading && error && (
            <Card>
              <Space direction="vertical" align="center" style={{ width: '100%' }}>
                <AlertTriangle size={64} color="#ff4d4f" />
                <Title level={3}>{translate('auto.a51a5ae17e')}</Title>
                <Text type="secondary">{error}</Text>
                <Button onClick={() => setRetry(value => value + 1)}>{translate('app.retry')}</Button>
              </Space>
            </Card>
          )}

          {!loading && !error && q && (
            <>
              <Card>
                <div
                  className="practice-question-heading"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}
                >
                  <Space>
                    <Tag color="blue">{typeLabel(q.question_type)}</Tag>
                    {q.difficulty && (
                      <Tag color={q.difficulty === 'easy' ? 'green' : q.difficulty === 'medium' ? 'orange' : 'red'}>
                        {diffLabel(q.difficulty)}
                      </Tag>
                    )}
                  </Space>
                  {answered && (
                    <Tag color={correct ? 'success' : 'error'} icon={<CheckCircle size={16} />}>
                      {correct ? translate('visible.7567ea3038') : translate('visible.dcc7740c26')}
                    </Tag>
                  )}
                  {answered && gradeDetail && (
                    <Tag color="purple">
                      {translate('auto.1cc7e9cace')}{gradeDetail.score}/{gradeDetail.maxScore}
                    </Tag>
                  )}
                </div>

                <div style={{ marginBottom: 24 }}>
                  <Text style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.6 }}>{q.content}</Text>
                </div>

                {(q.question_type === 'single_choice' || q.question_type === 'multiple_choice') && q.options && (
                  <Space direction="vertical" style={{ width: '100%', marginBottom: 24 }}>
                    {q.options.map((opt, i) => {
                      const isSel = selected.includes(i)
                      const isCorrect = !!opt.is_correct
                      const showC = answered && isCorrect
                      const showW = answered && isSel && !isCorrect
                      const Option = q.question_type === 'single_choice' ? Radio : Checkbox
                      return (
                        <Card
                          key={i}
                          className="practice-answer-option"
                          size="small"
                          style={{
                            backgroundColor: showC ? 'var(--practice-correct-bg)' : showW ? 'var(--practice-wrong-bg)' : isSel ? 'var(--practice-selected-bg)' : 'var(--ant-color-fill-alter)',
                            borderColor: showC ? '#b7eb8f' : showW ? '#ffccc7' : isSel ? '#91caff' : '#d9d9d9',
                            cursor: answered ? 'default' : 'pointer',
                          }}
                          onClick={() => {
                            if (answered || gradeLoading) return
                            if (q.question_type === 'single_choice') setSelected([i])
                            else setSelected(prev => (prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]))
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                              <Option
                                aria-label={opt.content}
                                onClick={event => event.stopPropagation()}
                                checked={isSel}
                                onChange={() => {
                                  if (answered || gradeLoading) return
                                  if (q.question_type === 'single_choice') setSelected([i])
                                  else
                                    setSelected(prev => (prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]))
                                }}
                                disabled={answered || gradeLoading}
                                style={{ marginRight: 12 }}
                              />
                              <Text>{opt.content}</Text>
                            </div>
                            {showC && <CheckCircle size={20} color="#52c41a" />}
                            {showW && <AlertTriangle size={20} color="#ff4d4f" />}
                          </div>
                        </Card>
                      )
                    })}
                  </Space>
                )}

                {q.question_type === 'true_false' && (
                  <Space direction="vertical" style={{ width: '100%', marginBottom: 24 }}>
                    {[translate('questions.tf_true'), translate('questions.tf_false')].map((label, i) => {
                      const isSel = selected.includes(i)
                      const idx = (q.correct_answer as string) === 'true' ? 0 : 1
                      const isCorrect = idx === i
                      const showC = answered && isCorrect
                      const showW = answered && isSel && !isCorrect
                      return (
                        <Card
                          key={i}
                          className="practice-answer-option"
                          size="small"
                          style={{
                            backgroundColor: showC ? 'var(--practice-correct-bg)' : showW ? 'var(--practice-wrong-bg)' : isSel ? 'var(--practice-selected-bg)' : 'var(--ant-color-fill-alter)',
                            borderColor: showC ? '#b7eb8f' : showW ? '#ffccc7' : isSel ? '#91caff' : '#d9d9d9',
                            cursor: answered ? 'default' : 'pointer',
                          }}
                          onClick={() => !answered && !gradeLoading && setSelected([i])}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                              <Radio
                                aria-label={label}
                                onClick={event => event.stopPropagation()}
                                checked={isSel}
                                onChange={() => !answered && !gradeLoading && setSelected([i])}
                                disabled={answered || gradeLoading}
                                style={{ marginRight: 12 }}
                              />
                              <Text>{label}</Text>
                            </div>
                            {showC && <CheckCircle size={20} color="#52c41a" />}
                            {showW && <AlertTriangle size={20} color="#ff4d4f" />}
                          </div>
                        </Card>
                      )
                    })}
                  </Space>
                )}

                {q.question_type === 'short_answer' && (
                  <div style={{ marginBottom: 24 }}>
                    <TextArea
                      value={text}
                      onChange={e => setText(e.target.value)}
                      placeholder={translate('auto.977e722666')}
                      disabled={answered || gradeLoading}
                      rows={6}
                    />
                  </div>
                )}

                {!answered ? (
                  <Button
                    type="primary"
                    size="large"
                    icon={<CheckCircle size={16} />}
                    onClick={submit}
                    loading={gradeLoading}
                    disabled={
                      gradeLoading || ((q.question_type === 'single_choice' ||
                        q.question_type === 'multiple_choice' ||
                        q.question_type === 'true_false') &&
                        selected.length === 0) ||
                      (q.question_type === 'short_answer' && !text.trim())
                    }
                  >
                    {translate('exam.submit')}</Button>
                ) : (
                  <Space>
                    <Button
                      icon={<BookOpen size={16} />}
                      disabled={gradeLoading}
                      onClick={() => {
                        setSelected([])
                        setText('')
                        setAnswered(false)
                        setCorrect(false)
                        setShowExp(false)
                        setGradeDetail(null)
                        setRecordError(null)
                      }}
                    >
                      {translate('auto.a5e6460134')}</Button>
                    <Button type="primary" size="large" onClick={goNext} disabled={navigationBusy}>
                      {isLast ? (hasNextPage ? translate('visible.67a246a344') : translate('visible.400fc97c8d')) : translate('exam.next')}{' '}
                      {!isLast && <ChevronRight size={16} />}
                    </Button>
                  </Space>
                )}
              </Card>

              {showExp && q.explanation && (
                <Card
                  title={
                    <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
                      {translate('aiAssistant.action.explain_question')}</Title>
                  }
                  style={{ backgroundColor: 'var(--practice-selected-bg)', borderColor: 'var(--ant-color-primary-border)' }}
                >
                  <Text style={{ color: '#1890ff', lineHeight: 1.6 }}>{q.explanation}</Text>
                </Card>
              )}

              {showExp && aiExp && (
                <Card
                  title={
                    <Title level={4} style={{ margin: 0, color: '#389e0d' }}>
                      {translate('auto.710dba6721')}</Title>
                  }
                  style={{ backgroundColor: '#f6ffed', borderColor: '#b7eb8f' }}
                >
                  <Text style={{ color: '#237804', lineHeight: 1.6 }}>{aiExp}</Text>
                </Card>
              )}

              {q.knowledge_points?.length ? (
                <Card
                  title={
                    <Title level={4} style={{ margin: 0 }}>
                      {translate('auto.8e00a85a37')}</Title>
                  }
                >
                  {q.knowledge_points.map((p, i) => (
                    <Tag key={i}>{p}</Tag>
                  ))}
                </Card>
              ) : null}
            </>
          )}
        </Spin>
      </Space>
    </div>
  )
}
