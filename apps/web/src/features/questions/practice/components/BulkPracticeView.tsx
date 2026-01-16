import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react'
import { AlertTriangle, ArrowLeft, CheckCircle, Eye, EyeOff, Heart, HeartOff, ArrowUp } from 'lucide-react'
import { Button, Card, Checkbox, Radio, Space, Spin, Tag, Typography, message, Input, BackTop, FloatButton } from 'antd'
import { wrongQuestions, questionsApi, isSuccess } from '@/shared/api/http'
import {
  addQuestionToFavorites,
  isQuestionFavorited,
  removeQuestionFromFavorites,
} from '@/features/questions/practice/utils/practiceApi'
import { aiApi } from '@/shared/api/endpoints/ai'

const { Title, Text } = Typography
const { TextArea } = Input

type Question = {
  id: string | number
  content: string
  question_type: 'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer' | string
  options?: Array<{ content: string; is_correct: boolean }>
  correct_answer?: number[] | string
  explanation?: string
  difficulty?: 'easy' | 'medium' | 'hard' | string
}

type Props = {
  ids: string[]
  onExit: () => void
}

const SHORT_ANSWER_PASS_RATE = 0.6
const SHORT_ANSWER_MAX_SCORE = 10

function judge(q: Question, selected: number[], text: string, aiCorrect?: boolean) {
  if (q.question_type === 'single_choice' || q.question_type === 'multiple_choice') {
    const correct = q.options?.map((opt, i) => (opt.is_correct ? i : -1)).filter(i => i !== -1) || []
    return selected.length === correct.length && selected.every(i => correct.includes(i))
  }
  if (q.question_type === 'true_false') {
    const idx = (q.correct_answer as string) === 'true' ? 0 : 1
    return selected[0] === idx
  }
  if (q.question_type === 'short_answer') return aiCorrect === true
  return false
}

export default function BulkPracticeView({ ids, onExit }: Props) {
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

  // 全局导航高度，按你的页面调整
  const TOP_OFFSET = 64

  // 回到顶部可见性
  const [showGoTop, setShowGoTop] = useState(false)
  useEffect(() => {
    const handler = () => {
      const top = window.document.documentElement.scrollTop || window.document.body.scrollTop
      setShowGoTop(top > 300)
    }
    window.addEventListener('scroll', handler, { passive: true })
    handler()
    return () => window.removeEventListener('scroll', handler)
  }, [])
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  // 拉题（一次性 batch）
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        if (!ids.length) {
          setQs([])
          setAnswers({})
          setFav({})
          return
        }
        const resp = await questionsApi.getByIds(ids)
        if (!isSuccess(resp)) throw new Error((resp as any).error || '加载题目失败')
        const ordered = (Array.isArray(resp.data) ? resp.data : []) as Question[]

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
          try {
            favMap[k] = await isQuestionFavorited(k)
          } catch {
            favMap[k] = false
          }
        }
        setAnswers(ans)
        setFav(favMap)

        window.scrollTo({ top: 0 })
      } catch (e: any) {
        if (mounted) setError(e?.message || '加载题目失败')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [ids])

  const summary = useMemo(() => {
    if (!submitted) return { total: qs.length, correct: 0 }
    let c = 0
    qs.forEach(q => {
      const a = answers[String(q.id)] || { selected: [], text: '' }
      if (judge(q, a.selected, a.text, a.aiCorrect)) c++
    })
    return { total: qs.length, correct: c }
  }, [submitted, qs, answers])

  const submitAll = async () => {
    setSubmitted(true)
    setGrading(true)
    const nextAnswers = { ...answers }
    const payloads: Array<{ id: string; ok: boolean; payload: any }> = []

    for (const q of qs) {
      const id = String(q.id)
      const a = nextAnswers[id] || { selected: [], text: '' }
      let ok = judge(q, a.selected, a.text, a.aiCorrect)

      if (q.question_type === 'short_answer') {
        if (!a.text?.trim()) {
          ok = false
          nextAnswers[id] = { ...a, aiCorrect: false, aiFeedback: '未作答' }
          payloads.push({ id, ok, payload: a.text })
          continue
        }
        try {
          const payload = {
            question: q.content,
            rubric: q.correct_answer,
            answer: a.text,
            max_score: SHORT_ANSWER_MAX_SCORE,
          }
          const res: any = await aiApi.gradeShortAnswer(payload)
          if (!res?.success) throw new Error(res?.error || 'AI 评分失败')
          const root = res?.data ?? {}
          const data = root?.data ?? root
          const score = Number(data?.score)
          const maxScore = Number(data?.max_score ?? payload.max_score)
          if (Number.isFinite(score) && Number.isFinite(maxScore)) {
            ok = score >= maxScore * SHORT_ANSWER_PASS_RATE
            nextAnswers[id] = {
              ...a,
              aiCorrect: ok,
              aiScore: score,
              aiMaxScore: maxScore,
              aiFeedback: data?.feedback,
            }
          } else {
            ok = false
            nextAnswers[id] = { ...a, aiCorrect: false }
          }
        } catch (e: any) {
          ok = false
          nextAnswers[id] = { ...a, aiCorrect: false, aiFeedback: 'AI 评分失败' }
        }
      }

      payloads.push({ id, ok, payload: q.question_type === 'short_answer' ? a.text : a.selected })
    }

    setAnswers(nextAnswers)
    setGrading(false)
    Promise.allSettled(
      payloads.map(p =>
        wrongQuestions.recordPractice({
          question_id: parseInt(p.id, 10),
          is_correct: p.ok,
          answer: p.payload,
        })
      )
    ).catch(() => {})
  }

  const typeLabel = (t?: string) =>
    (({ single_choice: '单选题', multiple_choice: '多选题', true_false: '判断题', short_answer: '简答题' } as any)[
      t || ''
    ] || t)
  const diffLabel = (d?: string) => (({ easy: '简单', medium: '中等', hard: '困难' } as any)[d || ''] || d)

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 顶部工具条 —— 用 sticky，不会遮挡内容 */}
        <div
          style={{
            position: 'sticky',
            top: TOP_OFFSET,
            zIndex: 1000,
            padding: '12px 16px',
            background: '#fff',
            borderRadius: 12,
            border: '1px solid rgba(15, 23, 42, 0.06)',
            boxShadow: '0 8px 24px -12px rgba(15, 23, 42, 0.25)',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <Space wrap size={12}>
              <Button icon={<ArrowLeft size={16} />} onClick={onExit}>
                返回列表
              </Button>
              <Tag color="blue">本页试题：{qs.length} 题</Tag>
              {submitted && (
                <Tag color="green">
                  成绩：{summary.correct} / {summary.total}
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
                {showExp ? '隐藏解析' : '显示解析'}
              </Button>
              {!submitted ? (
                <Button type="primary" onClick={submitAll} loading={grading}>
                  提交全部
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    const cleared: typeof answers = {}
                    qs.forEach(q => (cleared[String(q.id)] = { selected: [], text: '' }))
                    setAnswers(cleared)
                    setSubmitted(false)
                    setShowExp(false)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                >
                  重新作答
                </Button>
              )}
            </Space>
          </div>
        </div>

        <Spin spinning={loading} tip="加载题目中...">
          {!loading && error && (
            <Card>
              <Space direction="vertical" align="center" style={{ width: '100%' }}>
                <AlertTriangle size={64} color="#ff4d4f" />
                <Title level={3}>题目加载失败</Title>
                <Text type="secondary">{error}</Text>
              </Space>
            </Card>
          )}

          {!loading &&
            qs.map((q, idx) => {
              const k = String(q.id)
              const a = answers[k] || { selected: [], text: '' }
              const ok = submitted ? judge(q, a.selected, a.text, a.aiCorrect) : undefined
              return (
                <Card key={k} style={{ marginTop: 16 }}>
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}
                  >
                    <Space>
                      <Tag color="blue">{typeLabel(q.question_type)}</Tag>
                      {q.difficulty && (
                        <Tag color={q.difficulty === 'easy' ? 'green' : q.difficulty === 'medium' ? 'orange' : 'red'}>
                          {diffLabel(q.difficulty)}
                        </Tag>
                      )}
                      <Text type="secondary">#{idx + 1}</Text>
                    </Space>
                    <Space>
                      {submitted && (
                        <Tag color={ok ? 'success' : 'error'} icon={<CheckCircle size={16} />}>
                          {ok ? '正确' : '错误'}
                        </Tag>
                      )}
                      <Button
                        size="small"
                        icon={fav[k] ? <Heart size={16} /> : <HeartOff size={16} />}
                        onClick={async () => {
                          try {
                            if (fav[k]) {
                              await removeQuestionFromFavorites(k)
                              setFav(prev => ({ ...prev, [k]: false }))
                              message.success('已取消收藏')
                            } else {
                              await addQuestionToFavorites(k, (q.content || '').slice(0, 100))
                              setFav(prev => ({ ...prev, [k]: true }))
                              message.success('已添加到收藏')
                            }
                          } catch (e: any) {
                            message.error(e?.message || '操作失败')
                          }
                        }}
                        danger={!!fav[k]}
                        type={fav[k] ? 'primary' : 'default'}
                      >
                        {fav[k] ? '已收藏' : '收藏'}
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
                            size="small"
                            style={{
                              backgroundColor: showC ? '#f6ffed' : showW ? '#fff2f0' : isSel ? '#f0f5ff' : '#fafafa',
                              borderColor: showC ? '#b7eb8f' : showW ? '#ffccc7' : isSel ? '#91caff' : '#d9d9d9',
                              cursor: submitted ? 'default' : 'pointer',
                            }}
                            onClick={() => {
                              if (submitted) return
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
                                  checked={isSel}
                                  onChange={() => {
                                    if (submitted) return
                                    setAnswers(prev => {
                                      const cur = prev[k] || { selected: [], text: '' }
                                      let sel = cur.selected
                                      if (q.question_type === 'single_choice') sel = [oi]
                                      else sel = sel.includes(oi) ? sel.filter(x => x !== oi) : [...sel, oi]
                                      return { ...prev, [k]: { ...cur, selected: sel } }
                                    })
                                  }}
                                  disabled={submitted}
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
                      {['正确', '错误'].map((label, oi) => {
                        const isSel = a.selected.includes(oi)
                        const idx = (q.correct_answer as string) === 'true' ? 0 : 1
                        const isCorrect = idx === oi
                        const showC = submitted && isCorrect
                        const showW = submitted && isSel && !isCorrect
                        return (
                          <Card
                            key={oi}
                            size="small"
                            style={{
                              backgroundColor: showC ? '#f6ffed' : showW ? '#fff2f0' : isSel ? '#f0f5ff' : '#fafafa',
                              borderColor: showC ? '#b7eb8f' : showW ? '#ffccc7' : isSel ? '#91caff' : '#d9d9d9',
                              cursor: submitted ? 'default' : 'pointer',
                            }}
                            onClick={() => {
                              if (submitted) return
                              setAnswers(prev => ({
                                ...prev,
                                [k]: { ...(prev[k] || { selected: [], text: '' }), selected: [oi] },
                              }))
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                                <Radio
                                  checked={isSel}
                                  onChange={() => {
                                    if (submitted) return
                                    setAnswers(prev => ({
                                      ...prev,
                                      [k]: { ...(prev[k] || { selected: [], text: '' }), selected: [oi] },
                                    }))
                                  }}
                                  disabled={submitted}
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
                        if (submitted) return
                        const v = e.target.value
                        setAnswers(prev => ({ ...prev, [k]: { ...(prev[k] || { selected: [] }), text: v } }))
                      }}
                      placeholder="请输入您的答案..."
                      disabled={submitted}
                      rows={5}
                      style={{ marginTop: 8 }}
                    />
                  )}

                  {showExp && q.explanation && (
                    <Card
                      size="small"
                      style={{ marginTop: 12, backgroundColor: '#f0f5ff', borderColor: '#91caff' }}
                      title={
                        <Title level={5} style={{ margin: 0, color: '#1890ff' }}>
                          题目解析
                        </Title>
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
        <FloatButton.BackTop visibilityHeight={500}  duration={500}/>
      </Space>
    </div>
  )
}
