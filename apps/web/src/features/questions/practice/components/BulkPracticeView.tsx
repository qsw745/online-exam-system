// src/features/questions/practice/components/BulkPracticeView.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, CheckCircle, Eye, EyeOff, Heart, HeartOff } from 'lucide-react'
import { Button, Card, Checkbox, Radio, Space, Spin, Tag, Typography, message, Input } from 'antd'
import { wrongQuestions } from '@/shared/api/http'
import {
  addQuestionToFavorites,
  getQuestionById,
  isQuestionFavorited,
  removeQuestionFromFavorites,
} from '@/features/questions/practice/utils/practiceApi'

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

function judge(q: Question, selected: number[], text: string) {
  if (q.question_type === 'single_choice' || q.question_type === 'multiple_choice') {
    const correct = q.options?.map((opt, i) => (opt.is_correct ? i : -1)).filter(i => i !== -1) || []
    return selected.length === correct.length && selected.every(i => correct.includes(i))
  }
  if (q.question_type === 'true_false') {
    const idx = (q.correct_answer as string) === 'true' ? 0 : 1
    return selected[0] === idx
  }
  if (q.question_type === 'short_answer') return true
  return false
}

export default function BulkPracticeView({ ids, onExit }: Props) {
  const cacheRef = useRef<Map<string, Question>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [qs, setQs] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, { selected: number[]; text: string }>>({})
  const [submitted, setSubmitted] = useState(false)
  const [showExp, setShowExp] = useState(false)
  const [fav, setFav] = useState<Record<string, boolean>>({})

  // 拉取当前页所有题目详情
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const queue = [...ids]
        const results: Question[] = []
        const concurrency = 6
        const workers = new Array(concurrency).fill(0).map(async () => {
          while (queue.length) {
            const id = queue.shift()!
            try {
              let data = cacheRef.current.get(id)
              if (!data) {
                data = await getQuestionById(id)
                cacheRef.current.set(id, data)
              }
              results.push(data)
            } catch {}
          }
        })
        await Promise.all(workers)
        // 按 ids 顺序排好
        const map: Record<string, Question> = {}
        results.forEach(q => (map[String(q.id)] = q))
        const ordered = ids.map(id => map[id]).filter(Boolean) as Question[]

        if (!mounted) return
        setQs(ordered)
        setSubmitted(false)
        setShowExp(false)

        const ans: Record<string, { selected: number[]; text: string }> = {}
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
        if (mounted) {
          setAnswers(ans)
          setFav(favMap)
        }
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
      if (judge(q, a.selected, a.text)) c++
    })
    return { total: qs.length, correct: c }
  }, [submitted, qs, answers])

  const submitAll = async () => {
    setSubmitted(true)
    const payloads = qs.map(q => {
      const a = answers[String(q.id)] || { selected: [], text: '' }
      const ok = judge(q, a.selected, a.text)
      return {
        id: String(q.id),
        ok,
        payload: q.question_type === 'short_answer' ? a.text : a.selected,
      }
    })
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
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
          <Space>
            <Button
              icon={showExp ? <EyeOff size={16} /> : <Eye size={16} />}
              onClick={() => setShowExp(v => !v)}
              type="primary"
              ghost
            >
              {showExp ? '隐藏解析' : '显示解析'}
            </Button>
            {!submitted ? (
              <Button type="primary" onClick={submitAll}>
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
                  window.scrollTo({ top: 0 })
                }}
              >
                重新作答
              </Button>
            )}
          </Space>
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
              const ok = submitted ? judge(q, a.selected, a.text) : undefined
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
      </Space>
    </div>
  )
}
