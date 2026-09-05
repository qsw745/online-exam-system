import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, CheckCircle, Eye, EyeOff, Heart, HeartOff } from 'lucide-react'
import { Button, Card, Checkbox, Radio, Space, Spin, Tag, Typography, App, Alert, Empty, Input, FloatButton } from 'antd'
import { wrongQuestions, questionsApi, isSuccess } from '@/shared/api/http'
import {
  addQuestionToFavorites,
  getFavoriteQuestionIds,
  removeQuestionFromFavorites,
} from '@/features/questions/practice/utils/practiceApi'
import { aiApi } from '@/shared/api/endpoints/ai'
import { judgePracticeQuestion, normalizePracticeQuestion, parsePracticeGrade, type PracticeQuestion } from '../utils/practiceQuestion'
import { translate } from '@/shared/utils/i18n'

const { Title, Text } = Typography
const { TextArea } = Input

type Question = PracticeQuestion

type Props = {
  ids: string[]
  onExit: () => void
}

const SHORT_ANSWER_PASS_RATE = 0.6
const SHORT_ANSWER_MAX_SCORE = 10

export default function BulkPracticeView({ ids, onExit }: Props) {
  const { message } = App.useApp()
  const generation = useRef(0)
  const gradingLock = useRef(false)
  const favoriteLock = useRef(false)
  const editedFavoriteIds = useRef(new Set<string>())
  const [favoriteLoading, setFavoriteLoading] = useState(false)
  const [retry, setRetry] = useState(0)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [recordError, setRecordError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [qs, setQs] = useState<Question[]>([])
  const [answers, setAnswers] = useState<
    Record<
      string,
      {
        selected: number[]
        text: string
        aiCorrect?: boolean
        aiScore?: number
        aiMaxScore?: number
        aiFeedback?: string
      }
    >
  >({})
  const [submitted, setSubmitted] = useState(false)
  const [showExp, setShowExp] = useState(false)
  const [fav, setFav] = useState<Record<string, boolean>>({})
  const [grading, setGrading] = useState(false)

  // 拉题（一次性 batch）
  useEffect(() => {
    let mounted = true
    generation.current += 1
    gradingLock.current = false
    favoriteLock.current = false
    editedFavoriteIds.current = new Set()
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        setQs([])
        setGrading(false)
        setFavoriteLoading(false)
        setSubmissionError(null)
        setRecordError(null)
        if (!ids.length) {
          setQs([])
          setAnswers({})
          setFav({})
          return
        }
        const resp = await questionsApi.getByIds(ids)
        if (!isSuccess(resp)) throw new Error((resp as any).error || '加载题目失败')
        if (!Array.isArray(resp.data)) throw new Error('题目数据不完整，请重试')
        const fetched = new Map(resp.data.map(raw => { const q = normalizePracticeQuestion(raw); return [String(q.id), q] }))
        const ordered = ids.map(id => {
          const question = fetched.get(id)
          if (!question) throw new Error('部分题目已失效，请返回列表刷新')
          return question
        })

        if (!mounted) return
        setQs(ordered)
        setSubmitted(false)
        setShowExp(false)

        const ans: Record<
          string,
          { selected: number[]; text: string; aiCorrect?: boolean; aiScore?: number; aiMaxScore?: number; aiFeedback?: string }
        > = {}
        const favMap: Record<string, boolean> = {}
        for (const q of ordered) {
          const k = String(q.id)
          ans[k] = { selected: [], text: '' }
          favMap[k] = false
        }
        setAnswers(ans)
        setFav(favMap)
        void getFavoriteQuestionIds().then(favorites => {
          if (mounted) setFav(previous => Object.fromEntries(ordered.map(q => {
            const id = String(q.id)
            return [id, editedFavoriteIds.current.has(id) ? previous[id] : favorites.has(id)]
          })))
        }).catch(() => undefined)

        window.scrollTo({ top: 0 })
      } catch (e: any) {
        if (mounted) setError(e?.message || '加载题目失败')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
      generation.current += 1
    }
  }, [ids, retry])

  const summary = useMemo(() => {
    if (!submitted) return { total: qs.length, correct: 0 }
    let c = 0
    qs.forEach(q => {
      const a = answers[String(q.id)] || { selected: [], text: '' }
      if (judgePracticeQuestion(q, a.selected, a.aiCorrect)) c++
    })
    return { total: qs.length, correct: c }
  }, [submitted, qs, answers])

  const submitAll = async () => {
    if (gradingLock.current || submitted || loading || !qs.length) return
    const version = generation.current
    gradingLock.current = true
    setGrading(true)
    setSubmissionError(null)
    setRecordError(null)
    const nextAnswers = { ...answers }
    try {
      for (const q of qs) {
        const id = String(q.id)
        const answer = nextAnswers[id] || { selected: [], text: '' }
        if (q.question_type !== 'short_answer') continue
        if (!answer.text.trim()) {
          nextAnswers[id] = { ...answer, aiCorrect: false, aiFeedback: '未作答' }
          continue
        }
        if (answer.aiScore != null && answer.aiMaxScore != null) continue
        const res: any = await aiApi.gradeShortAnswer({ question: q.content, rubric: q.correct_answer,
          answer: answer.text, max_score: SHORT_ANSWER_MAX_SCORE })
        if (version !== generation.current) return
        if (!res?.success) throw new Error(res?.error || 'AI 评分失败')
        const grade = parsePracticeGrade(res.data?.data ?? res.data, SHORT_ANSWER_MAX_SCORE)
        nextAnswers[id] = { ...answer, aiCorrect: grade.score >= grade.maxScore * SHORT_ANSWER_PASS_RATE,
          aiScore: grade.score, aiMaxScore: grade.maxScore, aiFeedback: grade.feedback }
      }
      if (version !== generation.current) return
      setAnswers(nextAnswers)
      setSubmitted(true)
      setShowExp(true)
      const results = await Promise.allSettled(qs.map(async q => {
        const answer = nextAnswers[String(q.id)] || { selected: [], text: '' }
        const res = await wrongQuestions.recordPractice({ question_id: Number(q.id),
          is_correct: judgePracticeQuestion(q, answer.selected, answer.aiCorrect),
          answer: q.question_type === 'short_answer' ? answer.text : answer.selected })
        if (!isSuccess(res)) throw new Error(res.error || '练习记录未确认')
      }))
      if (version !== generation.current) return
      const failed = results.filter(result => result.status === 'rejected').length
      if (failed) setRecordError(`${failed} 条练习记录尚未确认，答题结果保留在当前页面。请稍后查看学习记录。`)
    } catch (error) {
      if (version !== generation.current) return
      setAnswers(nextAnswers)
      setSubmissionError(`${error instanceof Error ? error.message : '评分失败'}。答案已保留，请重试评分。`)
    } finally {
      if (version === generation.current) { gradingLock.current = false; setGrading(false) }
    }
  }

  const toggleFavorite = async (q: Question) => {
    if (favoriteLock.current) return
    const version = generation.current
    const id = String(q.id)
    editedFavoriteIds.current.add(id)
    favoriteLock.current = true
    setFavoriteLoading(true)
    try {
      if (fav[id]) await removeQuestionFromFavorites(id)
      else await addQuestionToFavorites(id, q.content.slice(0, 100))
      if (version !== generation.current) return
      setFav(previous => ({ ...previous, [id]: !fav[id] }))
      message.success(translate(fav[id] ? 'auto.0fc87e8309' : 'auto.143a521b56'))
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

  return (
    <div className="student-practice-session" style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 顶部工具条 —— 用 sticky，不会遮挡内容 */}
        <div
          className="practice-bulk-toolbar"
          style={{
            position: 'sticky',
            top: 64,
            zIndex: 30,
            padding: '12px 16px',
            background: 'var(--ant-color-bg-container)',
            borderRadius: 12,
            border: '1px solid rgba(15, 23, 42, 0.06)',
            boxShadow: '0 8px 24px -12px rgba(15, 23, 42, 0.25)',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <Space wrap size={12}>
              <Button icon={<ArrowLeft size={16} />} onClick={onExit}>
                {translate('papers.back_to_list')}</Button>
              <Tag color="blue">{translate('auto.c7e038341d')}{qs.length} {translate('papers.unit_question')}</Tag>
              {submitted && (
                <Tag color="green">
                  {translate('auto.16cde0126c')}{summary.correct} / {summary.total}
                </Tag>
              )}
            </Space>
            <Space wrap size={12} style={{ marginLeft: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                icon={showExp ? <EyeOff size={16} /> : <Eye size={16} />}
                onClick={() => setShowExp(v => !v)}
                type="primary"
                ghost
              >
                {showExp ? translate('visible.fbdfb3c5b1') : translate('visible.e25ef71017')}
              </Button>
              {!submitted ? (
                <Button type="primary" onClick={submitAll} loading={grading} disabled={loading || !qs.length}>
                  {translate('auto.fe82d08c17')}</Button>
              ) : (
                <Button
                  disabled={grading}
                  onClick={() => {
                    const cleared: typeof answers = {}
                    qs.forEach(q => (cleared[String(q.id)] = { selected: [], text: '' }))
                    setAnswers(cleared)
                    setSubmitted(false)
                    setRecordError(null)
                    setSubmissionError(null)
                    setShowExp(false)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                >
                  {translate('auto.36971023b6')}</Button>
              )}
            </Space>
          </div>
        </div>

        {submissionError && <Alert type="error" showIcon message={submissionError} />}
        {recordError && <Alert type="warning" showIcon message={recordError} />}
        <Spin spinning={loading} tip={translate('questions.loading')}>
          {!loading && error && (
            <Card>
              <Space direction="vertical" align="center" style={{ width: '100%' }}>
                <AlertTriangle size={64} color="#ff4d4f" />
                <Title level={3}>{translate('auto.c2bd90b611')}</Title>
                <Text type="secondary">{error}</Text>
                <Button onClick={() => setRetry(value => value + 1)}>{translate('app.retry')}</Button>
              </Space>
            </Card>
          )}

          {!loading && !error && !qs.length && <Empty description="没有可练习的题目，请返回列表" />}
          {!loading && !error &&
            qs.map((q, idx) => {
              const k = String(q.id)
              const a = answers[k] || { selected: [], text: '' }
              const ok = submitted ? judgePracticeQuestion(q, a.selected, a.aiCorrect) : undefined
              return (
                <Card key={k} style={{ marginTop: 16 }}>
                  <div
                    className="practice-question-heading"
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}
                  >
                    <Space>
                      <Tag color="blue">{typeLabel(q.question_type)}</Tag>
                      {q.difficulty && (
                        <Tag color={q.difficulty === 'easy' ? 'green' : q.difficulty === 'medium' ? 'orange' : 'red'}>
                          {diffLabel(q.difficulty)}
                        </Tag>
                      )}
                      <Text type="secondary" style={{ whiteSpace: 'nowrap' }}>#{idx + 1}</Text>
                    </Space>
                    <Space>
                      {submitted && (
                        <Tag color={ok ? 'success' : 'error'} icon={<CheckCircle size={16} />}>
                          {ok ? translate('questions.tf_true') : translate('questions.tf_false')}
                        </Tag>
                      )}
                      <Button
                        size="small"
                        icon={fav[k] ? <Heart size={16} /> : <HeartOff size={16} />}
                        onClick={() => void toggleFavorite(q)}
                        disabled={favoriteLoading}
                        danger={!!fav[k]}
                        type={fav[k] ? 'primary' : 'default'}
                      >
                        {fav[k] ? translate('visible.2d2cdabf29') : translate('header.favorites')}
                      </Button>
                    </Space>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.6 }}>{q.content}</Text>
                  </div>

                  {(q.question_type === 'single_choice' || q.question_type === 'multiple_choice') && q.options && (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      {q.options.map((opt, oi) => {
                        const isSel = a.selected.includes(oi)
                        const isCorrect = !!opt.is_correct
                        const showC = submitted && isCorrect
                        const showW = submitted && isSel && !isCorrect
                        const Option = q.question_type === 'single_choice' ? Radio : Checkbox
                        return (
                          <Card
                            key={oi}
                          className="practice-answer-option"
                            size="small"
                            style={{
                              backgroundColor: showC ? 'var(--practice-correct-bg)' : showW ? 'var(--practice-wrong-bg)' : isSel ? 'var(--practice-selected-bg)' : 'var(--ant-color-fill-alter)',
                              borderColor: showC ? '#b7eb8f' : showW ? '#ffccc7' : isSel ? '#91caff' : '#d9d9d9',
                              cursor: submitted ? 'default' : 'pointer',
                            }}
                            onClick={() => {
                              if (submitted || grading) return
                              setAnswers(prev => {
                                const cur = prev[k] || { selected: [], text: '' }
                                let sel = cur.selected
                                if (q.question_type === 'single_choice') sel = [oi]
                                else sel = sel.includes(oi) ? sel.filter(x => x !== oi) : [...sel, oi]
                                return { ...prev, [k]: { ...cur, selected: sel } }
                              })
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                                <Option
                                  aria-label={opt.content}
                                  onClick={event => event.stopPropagation()}
                                  checked={isSel}
                                  onChange={() => {
                                    if (submitted || grading) return
                                    setAnswers(prev => {
                                      const cur = prev[k] || { selected: [], text: '' }
                                      let sel = cur.selected
                                      if (q.question_type === 'single_choice') sel = [oi]
                                      else sel = sel.includes(oi) ? sel.filter(x => x !== oi) : [...sel, oi]
                                      return { ...prev, [k]: { ...cur, selected: sel } }
                                    })
                                  }}
                                  disabled={submitted || grading}
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
                    <Space direction="vertical" style={{ width: '100%' }}>
                      {[translate('questions.tf_true'), translate('questions.tf_false')].map((label, oi) => {
                        const isSel = a.selected.includes(oi)
                        const idx = (q.correct_answer as string) === 'true' ? 0 : 1
                        const isCorrect = idx === oi
                        const showC = submitted && isCorrect
                        const showW = submitted && isSel && !isCorrect
                        return (
                          <Card
                            key={oi}
                          className="practice-answer-option"
                            size="small"
                            style={{
                              backgroundColor: showC ? 'var(--practice-correct-bg)' : showW ? 'var(--practice-wrong-bg)' : isSel ? 'var(--practice-selected-bg)' : 'var(--ant-color-fill-alter)',
                              borderColor: showC ? '#b7eb8f' : showW ? '#ffccc7' : isSel ? '#91caff' : '#d9d9d9',
                              cursor: submitted ? 'default' : 'pointer',
                            }}
                            onClick={() => {
                              if (submitted || grading) return
                              setAnswers(prev => ({
                                ...prev,
                                [k]: { ...(prev[k] || { selected: [], text: '' }), selected: [oi] },
                              }))
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                                <Radio
                                  aria-label={label}
                                  onClick={event => event.stopPropagation()}
                                  checked={isSel}
                                  onChange={() => {
                                    if (submitted || grading) return
                                    setAnswers(prev => ({
                                      ...prev,
                                      [k]: { ...(prev[k] || { selected: [], text: '' }), selected: [oi] },
                                    }))
                                  }}
                                  disabled={submitted || grading}
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
                    <TextArea
                      value={a.text}
                      onChange={e => {
                        if (submitted || grading) return
                        const v = e.target.value
                        setAnswers(prev => ({ ...prev, [k]: { selected: [], text: v } }))
                      }}
                      placeholder={translate('auto.977e722666')}
                      disabled={submitted || grading}
                      rows={5}
                      style={{ marginTop: 8 }}
                    />
                  )}

                  {showExp && q.explanation && (
                    <Card
                      size="small"
                      style={{ marginTop: 12, backgroundColor: 'var(--practice-selected-bg)', borderColor: '#91caff' }}
                      title={
                        <Title level={5} style={{ margin: 0, color: '#1890ff' }}>
                          {translate('aiAssistant.action.explain_question')}</Title>
                      }
                    >
                      <Text style={{ color: '#1890ff', lineHeight: 1.6 }}>{q.explanation}</Text>
                    </Card>
                  )}
                </Card>
              )
            })}
        </Spin>

        {/* 左下角回到顶部 */}
        {/* <BackTop visibilityHeight={300} style={{ right: 24, bottom: 24 }} /> */}
        <FloatButton.BackTop className="practice-back-top" visibilityHeight={500}  duration={500}/>
      </Space>
    </div>
  )
}
