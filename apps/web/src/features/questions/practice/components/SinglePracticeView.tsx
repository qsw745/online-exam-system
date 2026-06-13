// src/features/questions/practice/components/SinglePracticeView.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
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
import { Button, Card, Checkbox, Radio, Space, Spin, Tag, Typography, message, Input } from 'antd'
import { wrongQuestions } from '@/shared/api/http'
import {
  getQuestionById,
  isQuestionFavorited,
  addQuestionToFavorites,
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
  knowledge_points?: string[]
}

type Props = {
  ids: string[]
  startIndex: number
  onExit: () => void
  onIndexChange?: (index: number) => void
  onNextPage?: () => boolean | void
  hasNextPage?: boolean
}

const SHORT_ANSWER_PASS_RATE = 0.6
const SHORT_ANSWER_MAX_SCORE = 10

function judge(q: Question, selected: number[], text: string) {
  if (q.question_type === 'single_choice' || q.question_type === 'multiple_choice') {
    const correct = q.options?.map((opt, i) => (opt.is_correct ? i : -1)).filter(i => i !== -1) || []
    return selected.length === correct.length && selected.every(i => correct.includes(i))
  }
  if (q.question_type === 'true_false') {
    const idx = (q.correct_answer as string) === 'true' ? 0 : 1
    return selected[0] === idx
  }
  if (q.question_type === 'short_answer') return false
  return false
}

export default function SinglePracticeView({
  ids,
  startIndex,
  onExit,
  onIndexChange,
  onNextPage,
  hasNextPage,
}: Props) {
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

  // 加载题目
  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!qid) return
      try {
        setLoading(true)
        setError(null)
        let data = cacheRef.current.get(qid)
        if (!data) {
          const fetched = (await getQuestionById(qid)) as Question | undefined
          if (!fetched) throw new Error('题目不存在')
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
        try {
          const f = await isQuestionFavorited(qid)
          if (mounted) setFav(!!f)
        } catch {}
      } catch (e: any) {
        if (mounted) setError(e?.message || '加载题目失败')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [qid])

  useEffect(() => {
    setIndex(startIndex)
  }, [startIndex, ids])

  useEffect(() => {
    if (typeof onIndexChange === 'function') onIndexChange(index)
  }, [index, onIndexChange])

  const progress = useMemo(() => `${index + 1} / ${ids.length}`, [index, ids.length])

  const submit = async () => {
    if (!q) return
    let ok = judge(q, selected, text)
    if (q.question_type === 'short_answer') {
      setGradeLoading(true)
      try {
        const payload = {
          question: q.content,
          rubric: q.correct_answer,
          answer: text,
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
          setGradeDetail({ score, maxScore, feedback: data?.feedback })
          message.info(`AI 评分：${score}/${maxScore}`)
        } else {
          ok = false
          setGradeDetail(null)
          message.warning('AI 评分结果不完整')
        }
      } catch (e: any) {
        message.error(e?.message || 'AI 评分失败')
        return
      } finally {
        setGradeLoading(false)
      }
    }
    setCorrect(ok)
    setAnswered(true)
    setShowExp(true)
    try {
      await wrongQuestions.recordPractice({
        question_id: parseInt(String(q.id), 10),
        is_correct: ok,
        answer: q.question_type === 'short_answer' ? text : selected,
      })
    } catch {}
  }

  const goPrev = () => setIndex(i => Math.max(0, i - 1))
  const goNext = () => {
    setIndex(i => {
      const next = i + 1
      if (next >= ids.length) {
        if (hasNextPage && onNextPage) {
          const ok = onNextPage()
          if (ok !== false) message.success('已进入下一页继续练习')
          return i
        }
        message.success('恭喜！您已完成当前页所有题目')
        onExit()
        return i
      }
      return next
    })
  }

  const typeLabel = (t?: string) =>
    (({ single_choice: '单选题', multiple_choice: '多选题', true_false: '判断题', short_answer: '简答题' } as any)[
      t || ''
    ] || t)

  const diffLabel = (d?: string) => (({ easy: '简单', medium: '中等', hard: '困难' } as any)[d || ''] || d)

  const requestAiExplain = async () => {
    if (!q || aiLoading) return
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
      if (!res?.success) throw new Error(res?.error || 'AI 解析失败')
      const root = res?.data ?? {}
      const data = root?.data ?? root
      const exp = data?.explanation || data?.raw || ''
      if (exp) {
        setAiExp(exp)
        setShowExp(true)
      } else {
        message.warning('AI 未返回解析内容')
      }
    } catch (e: any) {
      message.error(e?.message || 'AI 解析失败')
    } finally {
      setAiLoading(false)
    }
  }

  const isLast = index === ids.length - 1
  const canAdvance = !isLast || !!hasNextPage

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button icon={<ArrowLeft size={16} />} onClick={onExit}>
              返回列表
            </Button>
            {!!ids.length && <Tag color="blue">进度：{progress}</Tag>}
          </Space>
          <Space>
            <Button icon={<ChevronLeft size={16} />} onClick={goPrev} disabled={index === 0}>
              上一题
            </Button>
            <Button
              icon={<SkipForward size={16} />}
              onClick={goNext}
              style={{ color: '#fa8c16', borderColor: '#fa8c16' }}
            >
              跳过
            </Button>
            <Button type="primary" onClick={goNext} disabled={!canAdvance}>
              {isLast && hasNextPage ? '下一页' : '下一题'} <ChevronRight size={16} />
            </Button>
            <Button
              icon={fav ? <Heart size={16} /> : <HeartOff size={16} />}
              onClick={async () => {
                if (!q) return
                try {
                  if (fav) {
                    await removeQuestionFromFavorites(String(q.id))
                    setFav(false)
                    message.success('已取消收藏')
                  } else {
                    await addQuestionToFavorites(String(q.id), (q.content || '').slice(0, 100))
                    setFav(true)
                    message.success('已添加到收藏')
                  }
                } catch (e: any) {
                  message.error(e?.message || '操作失败')
                }
              }}
              danger={fav}
              type={fav ? 'primary' : 'default'}
            >
              {fav ? '已收藏' : '收藏'}
            </Button>
            <Button
              icon={showExp ? <EyeOff size={16} /> : <Eye size={16} />}
              onClick={() => setShowExp(v => !v)}
              type="primary"
              ghost
            >
              {showExp ? '隐藏解析' : '查看解析'}
            </Button>
            <Button icon={<Sparkles size={16} />} onClick={requestAiExplain} loading={aiLoading} disabled={!q}>
              AI解析
            </Button>
          </Space>
        </div>

        <Spin spinning={loading} tip="加载题目中...">
          {!loading && error && (
            <Card>
              <Space direction="vertical" align="center" style={{ width: '100%' }}>
                <AlertTriangle size={64} color="#ff4d4f" />
                <Title level={3}>题目不存在</Title>
                <Text type="secondary">{error}</Text>
              </Space>
            </Card>
          )}

          {!loading && q && (
            <>
              <Card>
                <div
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
                      {correct ? '回答正确' : '回答错误'}
                    </Tag>
                  )}
                  {answered && gradeDetail && (
                    <Tag color="purple">
                      AI 评分 {gradeDetail.score}/{gradeDetail.maxScore}
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
                          size="small"
                          style={{
                            backgroundColor: showC ? '#f6ffed' : showW ? '#fff2f0' : isSel ? '#f0f5ff' : '#fafafa',
                            borderColor: showC ? '#b7eb8f' : showW ? '#ffccc7' : isSel ? '#91caff' : '#d9d9d9',
                            cursor: answered ? 'default' : 'pointer',
                          }}
                          onClick={() => {
                            if (answered) return
                            if (q.question_type === 'single_choice') setSelected([i])
                            else setSelected(prev => (prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]))
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                              <Option
                                checked={isSel}
                                onChange={() => {
                                  if (answered) return
                                  if (q.question_type === 'single_choice') setSelected([i])
                                  else
                                    setSelected(prev => (prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]))
                                }}
                                disabled={answered}
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
                    {['正确', '错误'].map((label, i) => {
                      const isSel = selected.includes(i)
                      const idx = (q.correct_answer as string) === 'true' ? 0 : 1
                      const isCorrect = idx === i
                      const showC = answered && isCorrect
                      const showW = answered && isSel && !isCorrect
                      return (
                        <Card
                          key={i}
                          size="small"
                          style={{
                            backgroundColor: showC ? '#f6ffed' : showW ? '#fff2f0' : isSel ? '#f0f5ff' : '#fafafa',
                            borderColor: showC ? '#b7eb8f' : showW ? '#ffccc7' : isSel ? '#91caff' : '#d9d9d9',
                            cursor: answered ? 'default' : 'pointer',
                          }}
                          onClick={() => !answered && setSelected([i])}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                              <Radio
                                checked={isSel}
                                onChange={() => !answered && setSelected([i])}
                                disabled={answered}
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
                      placeholder="请输入您的答案..."
                      disabled={answered}
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
                      ((q.question_type === 'single_choice' ||
                        q.question_type === 'multiple_choice' ||
                        q.question_type === 'true_false') &&
                        selected.length === 0) ||
                      (q.question_type === 'short_answer' && !text.trim())
                    }
                  >
                    提交答案
                  </Button>
                ) : (
                  <Space>
                    <Button
                      icon={<BookOpen size={16} />}
                      onClick={() => {
                        setSelected([])
                        setText('')
                        setAnswered(false)
                        setCorrect(false)
                        setShowExp(false)
                        setGradeDetail(null)
                      }}
                    >
                      重新练习
                    </Button>
                    <Button type="primary" size="large" onClick={goNext} disabled={!canAdvance}>
                      {isLast ? (hasNextPage ? '下一页' : '已完成本页') : '下一题'}{' '}
                      {!isLast && <ChevronRight size={16} />}
                    </Button>
                  </Space>
                )}
              </Card>

              {showExp && q.explanation && (
                <Card
                  title={
                    <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
                      题目解析
                    </Title>
                  }
                  style={{ backgroundColor: '#f0f5ff', borderColor: '#91caff' }}
                >
                  <Text style={{ color: '#1890ff', lineHeight: 1.6 }}>{q.explanation}</Text>
                </Card>
              )}

              {showExp && aiExp && (
                <Card
                  title={
                    <Title level={4} style={{ margin: 0, color: '#389e0d' }}>
                      AI解析
                    </Title>
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
                      相关知识点
                    </Title>
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
