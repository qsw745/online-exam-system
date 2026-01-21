import React from 'react'
import {
  App,
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Modal,
  Progress,
  Result,
  Row,
  Space,
  Tag,
  Typography,
  Radio,
  Checkbox,
  Input,
} from 'antd'
import { AlertTriangle, Clock, Flag, Send } from 'lucide-react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import dayjs from '@/shared/utils/dayjs'
import LoadingSpinner from '@/shared/components/LoadingSpinner'
import { tasksApi } from '@/shared/api/endpoints/tasks'
import { isSuccess } from '@/shared/api/http'
import { useAiProctoring, type ProctoringConfig } from '@/features/exams/hooks/useAiProctoring'

type Question = {
  id: number
  type: 'single' | 'single_choice' | 'multiple' | 'multiple_choice' | 'true_false' | 'short_answer' | string
  content: string
  options?: string[] | null
  score: number
  order: number
}

type AntiCheatConfig = {
  level: 'none' | 'basic' | 'strict'
  maxSwitches: number
  disableCopy?: boolean
  autoSubmit?: boolean
}

type ExamPayload = {
  taskId: number
  examId: number
  paperId: number
  duration: number
  status: 'in_progress' | 'not_started' | 'submitted'
  startedAt?: string | null
  endTime?: string | null
  title: string
  description?: string | null
  questions: Question[]
  antiCheat?: AntiCheatConfig
  proctoring?: ProctoringConfig
}

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input
const antiCheatLabels: Record<AntiCheatConfig['level'], string> = {
  none: '关闭',
  basic: '基础',
  strict: '严格',
}

const letter = (i: number) => String.fromCharCode(65 + i)
const isSingle = (t: string) => ['single', 'single_choice'].includes(t?.toLowerCase())
const isMulti = (t: string) => ['multiple', 'multiple_choice'].includes(t?.toLowerCase())
const isTF = (t: string) => ['true_false', 'judge', 'tf'].includes(t?.toLowerCase())
const isShort = (t: string) => ['short', 'short_answer', 'essay', 'text', 'fill_blank'].includes(t?.toLowerCase())

function ensureTfOptions(q: Question) {
  if (isTF(q.type)) return ['正确', '错误']
  return Array.isArray(q.options) ? q.options : []
}

/** 将“已选答案字符串”转为勾选值（Radio: 'A'，Checkbox: ['A','C']；主观题返回原文） */
function parseAnswerValue(q: Question, ans?: string) {
  if (isShort(q.type)) return ans ?? ''
  if (isMulti(q.type)) {
    return (ans || '')
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(Boolean)
      .sort()
  }
  return (ans || '').toUpperCase() || undefined
}

/** 由勾选值生成提交字符串（单选 'A'；多选 'A,B'；主观题为原文） */
function buildAnswerValue(q: Question, val: any) {
  if (isShort(q.type)) return String(val ?? '').trim()
  if (isMulti(q.type)) {
    const arr = Array.isArray(val) ? val : []
    return arr
      .map((s: string) => s.toUpperCase())
      .sort()
      .join(',')
  }
  return (val || '').toString().toUpperCase()
}

/** 题型显示标签 */
function TypeTag({ type }: { type: string }) {
  const t = type.toLowerCase()
  if (isSingle(t)) return <Tag color="blue">单选题</Tag>
  if (isMulti(t)) return <Tag color="purple">多选题</Tag>
  if (isTF(t)) return <Tag color="green">判断题</Tag>
  if (isShort(t)) return <Tag color="gold">主观题</Tag>
  return <Tag>题目</Tag>
}

export default function ExamPage() {
  // /exam/:id —— 这里的 id 可能是 examId，也可能是 taskId（后端已兼容）
  const { id = '' } = useParams<{ id: string }>()
  const location = useLocation() as any
  const navigate = useNavigate()
  const { message } = App.useApp()

  const [loading, setLoading] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)
  const [exam, setExam] = React.useState<ExamPayload | null>(() => {
    const s = location?.state
    if (s && typeof s === 'object' && Array.isArray(s.questions) && s.examId) {
      s.questions = (s.questions as Question[]).map(q => ({
        ...q,
        options: isTF(q.type) ? ['正确', '错误'] : Array.isArray(q.options) ? q.options : q.options ?? [],
      }))
      return s as ExamPayload
    }
    return null
  })

  /** 答案存储：单选/判断：'A'；多选：'A,B,D'；主观题：文本字符串 */
  const [answers, setAnswers] = React.useState<Record<number, string>>({})
  const [flagged, setFlagged] = React.useState<Set<number>>(new Set())
  const [timeLeft, setTimeLeft] = React.useState<number>(0) // 秒

  /** 拉取试卷 */
  React.useEffect(() => {
    let alive = true
    const boot = async () => {
      try {
        if (!exam) {
          const res: any = await tasksApi.startExam(id)
          if (!alive) return
          if (!isSuccess(res)) throw new Error(res?.message || '加载试卷失败')
          const data = (res.data ?? res) as ExamPayload
          data.questions = (data.questions || []).map(q => ({
            ...q,
            options: isTF(q.type) ? ['正确', '错误'] : Array.isArray(q.options) ? q.options : q.options ?? null,
          }))
          setExam(data)
          if (data.status === 'submitted') {
            message.info('本场考试已提交，正在打开成绩页…')
            navigate(`/results/${data.examId}`, { replace: true })
            return
          }
        }
      } catch (e: any) {
        message.error(e?.message || '加载试卷失败')
      } finally {
        if (alive) setLoading(false)
      }
    }
    boot()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  /** 倒计时（优先截止时间，其次开始时间+duration） */
  React.useEffect(() => {
    if (!exam) return
    const start = exam.startedAt ? dayjs(exam.startedAt) : dayjs()
    const d1 = start.add(exam.duration || 60, 'minute')
    const d2 = exam.endTime ? dayjs(exam.endTime) : null
    const deadline = d2 && d2.isBefore(d1) ? d2 : d1

    const tick = () => {
      const sec = Math.max(0, deadline.diff(dayjs(), 'second'))
      setTimeLeft(sec)
      if (sec <= 0) doSubmit(true)
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [exam])

  const total = exam?.questions?.length || 0
  const answeredCount = React.useMemo(() => {
    if (!exam) return 0
    return exam.questions.filter(q => {
      const a = answers[q.id]
      if (isShort(q.type)) return (a ?? '').trim().length > 0
      return !!a
    }).length
  }, [exam, answers])

  /** 交互 */
  const setAnswer = React.useCallback((q: Question, val: any) => {
    setAnswers(prev => ({ ...prev, [q.id]: buildAnswerValue(q, val) }))
  }, [])

  const toggleFlag = React.useCallback((qid: number) => {
    setFlagged(prev => {
      const n = new Set(prev)
      n.has(qid) ? n.delete(qid) : n.add(qid)
      return n
    })
  }, [])

  const scrollTo = (qid: number) => {
    const el = document.getElementById(`q-${qid}`)
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 90
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  const doSubmit = async (auto = false) => {
    if (!exam || submitting) return
    try {
      if (!auto) {
        const ok = await new Promise<boolean>(resolve => {
          Modal.confirm({
            title: '确认提交',
            content: `已作答 ${answeredCount}/${total} 题，确认提交吗？`,
            okText: '提交',
            cancelText: '再检查下',
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
          })
        })
        if (!ok) return
      }

      setSubmitting(true)
      const timeSpent = exam.startedAt ? Math.max(0, dayjs().diff(dayjs(exam.startedAt), 'second')) : 0

      // ✅ 使用统一的 API 封装，且不再在此处调用任何 Hook（避免 Invalid Hook Call）
      const res: any = await tasksApi.submit(exam.taskId, {
        answers,
        time_spent: timeSpent,
      })
      if (!isSuccess(res)) throw new Error(res?.message || '提交失败')
      if (!auto) message.success('提交成功')
      navigate(`/results/${exam.examId}`)
    } catch (e: any) {
      message.error(e?.message || '提交失败')
      if (auto) setTimeout(() => navigate('/dashboard'), 800)
    } finally {
      setSubmitting(false)
    }
  }
  const doSubmitRef = React.useRef<(auto?: boolean) => Promise<void>>(async () => {})
  React.useEffect(() => {
    doSubmitRef.current = doSubmit
  }, [doSubmit])
  const antiCheat = exam?.antiCheat ?? { level: 'none' as AntiCheatConfig['level'], maxSwitches: Number.MAX_SAFE_INTEGER }
  const proctoring = React.useMemo<ProctoringConfig>(() => {
    if (exam?.proctoring) return exam.proctoring
    const level = antiCheat.level === 'strict' ? 'strict' : antiCheat.level === 'basic' ? 'basic' : 'off'
    return {
      enabled: level !== 'off',
      level,
      requireCamera: level !== 'off',
      requireMic: level === 'strict',
      intervalMs: level === 'strict' ? 2500 : 4000,
    }
  }, [antiCheat.level, exam?.proctoring])
  const {
    status: proctorStatus,
    videoRef: proctorVideoRef,
    reportEvent: reportProctorEvent,
    restart: restartProctoring,
  } = useAiProctoring({
    examId: exam?.examId,
    taskId: exam?.taskId,
    config: proctoring,
  })
  const violationRef = React.useRef(0)
  const [violationCount, setViolationCount] = React.useState(0)
  const forcedRef = React.useRef(false)

  React.useEffect(() => {
    violationRef.current = 0
    forcedRef.current = false
    setViolationCount(0)
  }, [antiCheat.level])

  React.useEffect(() => {
    if (!exam || antiCheat.level === 'none') return
    const limit = antiCheat.maxSwitches && Number.isFinite(antiCheat.maxSwitches)
      ? antiCheat.maxSwitches
      : antiCheat.level === 'strict'
      ? 1
      : 3

    const severity = antiCheat.level === 'strict' ? 'critical' : 'warn'
    const handleViolation = (reason: string, type: string) => {
      violationRef.current += 1
      setViolationCount(violationRef.current)
      const remaining = Math.max(0, limit - violationRef.current)
      message.warning(`${reason}${remaining < Number.MAX_SAFE_INTEGER ? `（剩余 ${remaining} 次）` : ''}`)
      reportProctorEvent({
        type,
        severity,
        message: reason,
        meta: { remaining },
      })
      if (!forcedRef.current && violationRef.current >= limit) {
        forcedRef.current = true
        if (antiCheat.autoSubmit) {
          Modal.warning({
            title: '防作弊提醒',
            content: '检测到多次离开考试页面，系统将自动提交试卷。',
            okText: '立即提交',
            centered: true,
            closable: false,
            maskClosable: false,
            onOk: () => doSubmitRef.current(true),
          })
        } else {
          message.error('请立即回到考试页面，继续作答')
        }
      }
    }

    const handleBlur = () => handleViolation('检测到离开考试窗口', 'window_blur')
    const handleVisibility = () => {
      if (document.hidden) handleViolation('检测到切换到其他标签', 'tab_hidden')
    }
    const handleCopy = (e: ClipboardEvent) => {
      if (antiCheat.disableCopy) {
        e.preventDefault()
        message.warning('考试期间禁止复制内容')
        reportProctorEvent({ type: 'copy_blocked', severity: 'info', message: '检测到复制行为' })
      }
    }
    window.addEventListener('blur', handleBlur)
    document.addEventListener('visibilitychange', handleVisibility)
    if (antiCheat.disableCopy) {
      document.addEventListener('copy', handleCopy)
    }
    return () => {
      window.removeEventListener('blur', handleBlur)
      document.removeEventListener('visibilitychange', handleVisibility)
      if (antiCheat.disableCopy) {
        document.removeEventListener('copy', handleCopy)
      }
    }
  }, [
    exam,
    antiCheat.level,
    antiCheat.maxSwitches,
    antiCheat.disableCopy,
    antiCheat.autoSubmit,
    message,
    reportProctorEvent,
  ])

  /** ---------------- UI 渲染 ---------------- */
  if (loading) return <LoadingSpinner center="page" text="加载中…" />

  if (!exam) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Result
          status="404"
          title="试卷不存在"
          subTitle="当前任务未找到试卷或数据无效。"
          icon={<AlertTriangle className="w-12 h-12 text-red-500" />}
          extra={
            <Button type="primary" onClick={() => navigate('/dashboard')}>
              返回首页
            </Button>
          }
        />
      </div>
    )
  }

  const mm = Math.floor(timeLeft / 60)
  const ss = (timeLeft % 60).toString().padStart(2, '0')
  const percent = Math.max(0, Math.min(100, ((exam.duration * 60 - timeLeft) / (exam.duration * 60)) * 100))
  const statusLabel = (val: string) =>
    ({
      init: '检测中',
      ok: '正常',
      off: '关闭',
      denied: '未授权',
      error: '异常',
      unknown: '未知',
      missing: '未检测到人脸',
      multiple: '多人',
      dark: '过暗',
      quiet: '安静',
      noisy: '有噪声',
    })[val] ?? val
  const statusColor = (val: string) => {
    if (val === 'ok' || val === 'quiet') return 'success'
    if (val === 'multiple' || val === 'denied' || val === 'error') return 'error'
    if (val === 'missing' || val === 'dark' || val === 'noisy') return 'warning'
    if (val === 'off') return 'default'
    return 'default'
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
      {/* 顶部栏（固定） */}
      <div style={{ position: 'sticky', top: 0, zIndex: 30 }}>
        <Card styles={{ body: { padding: 12 } }} style={{ borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,.04)' }}>
          <Row gutter={16} align="middle">
            <Col flex="auto">
              <Space direction="vertical" size={0}>
                <Title level={4} style={{ margin: 0 }}>
                  {exam.title}
                </Title>
                {exam.description ? <Text type="secondary">{exam.description}</Text> : null}
                <Space size="small" wrap style={{ marginTop: 4 }}>
                  <Tag color={antiCheat.level === 'strict' ? 'red' : antiCheat.level === 'basic' ? 'orange' : 'default'}>
                    防作弊：{antiCheatLabels[antiCheat.level]}
                  </Tag>
                  {antiCheat.level !== 'none' && Number.isFinite(antiCheat.maxSwitches) ? (
                    <Text type="secondary">允许切换次数：{antiCheat.maxSwitches}</Text>
                  ) : null}
                </Space>
              </Space>
            </Col>
            <Col>
              <Space size={16} align="center">
                <Space>
                  <Clock size={18} />
                  <Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {mm}:{ss}
                  </Text>
                </Space>
                <Progress type="circle" size={44} percent={parseFloat(percent.toFixed(1))} />
                <Button type="primary" icon={<Send size={16} />} onClick={() => doSubmit(false)} loading={submitting}>
                  提交
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>
      </div>

      <Divider />

      <Row gutter={16} align="top">
        {/* 左侧：题目列表 */}
        <Col xs={24} lg={17}>
          {exam.questions.length === 0 ? (
            <Empty description="暂无题目" />
          ) : (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              {exam.questions.map((q, idx) => {
                const qno = idx + 1
                const valueParsed = parseAnswerValue(q, answers[q.id])
                const opts = isTF(q.type) ? ensureTfOptions(q) : Array.isArray(q.options) ? q.options : []

                return (
                  <Card
                    id={`q-${q.id}`}
                    key={q.id}
                    hoverable
                    style={{ borderRadius: 12 }}
                    title={
                      <Row align="middle" justify="space-between">
                        <Col>
                          <Space size="small" wrap>
                            <Text strong>第 {qno} 题</Text>
                            <TypeTag type={q.type} />
                            <Tag color="gold">{q.score} 分</Tag>
                          </Space>
                        </Col>
                        <Col>
                          <Button
                            size="small"
                            type={flagged.has(q.id) ? 'default' : 'text'}
                            icon={<Flag size={16} color={flagged.has(q.id) ? '#faad14' : undefined} />}
                            onClick={() => toggleFlag(q.id)}
                          >
                            {flagged.has(q.id) ? '已标记' : '标记'}
                          </Button>
                        </Col>
                      </Row>
                    }
                  >
                    <Paragraph style={{ marginBottom: 16 }}>
                      <span dangerouslySetInnerHTML={{ __html: q.content || '' }} />
                    </Paragraph>

                    {/* 渲染不同题型 */}
                    {isShort(q.type) ? (
                      <TextArea
                        autoSize={{ minRows: 3, maxRows: 8 }}
                        value={valueParsed as string}
                        placeholder="在此作答…"
                        onChange={e => setAnswer(q, e.target.value)}
                      />
                    ) : isMulti(q.type) ? (
                      <Checkbox.Group
                        value={valueParsed as string[]}
                        onChange={vals => setAnswer(q, vals as string[])}
                        style={{ width: '100%' }}
                      >
                        <Space direction="vertical" style={{ width: '100%' }} size={8}>
                          {opts.map((opt, i) => {
                            const L = letter(i)
                            return (
                              <Checkbox key={i} value={L} style={{ width: '100%' }}>
                                <Space align="start">
                                  <Tag color="processing">{L}</Tag>
                                  <span>{opt}</span>
                                </Space>
                              </Checkbox>
                            )
                          })}
                        </Space>
                      </Checkbox.Group>
                    ) : (
                      <Radio.Group
                        value={valueParsed as string | undefined}
                        onChange={e => setAnswer(q, e.target.value)}
                        style={{ width: '100%' }}
                      >
                        <Space direction="vertical" style={{ width: '100%' }} size={8}>
                          {opts.map((opt, i) => {
                            const L = letter(i)
                            return (
                              <Radio key={i} value={L} style={{ width: '100%' }}>
                                <Space align="start">
                                  <Tag color="processing">{L}</Tag>
                                  <span>{opt}</span>
                                </Space>
                              </Radio>
                            )
                          })}
                        </Space>
                      </Radio.Group>
                    )}
                  </Card>
                )
              })}
            </Space>
          )}
        </Col>

        {/* 右侧：答题卡 */}
        <Col xs={24} lg={7} style={{ marginTop: 16 }}>
          <div style={{ position: 'sticky', top: 92 }}>
            {proctoring.enabled && (
              <Card title="AI监管" style={{ borderRadius: 12, marginBottom: 16 }}>
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <div style={{ background: '#0f172a', borderRadius: 8, overflow: 'hidden' }}>
                    <video
                      ref={proctorVideoRef}
                      style={{ width: '100%', display: 'block', aspectRatio: '16 / 9', objectFit: 'cover' }}
                    />
                  </div>
                  <Space size={[8, 8]} wrap>
                    <Tag color={statusColor(proctorStatus.camera)}>摄像头：{statusLabel(proctorStatus.camera)}</Tag>
                    <Tag color={statusColor(proctorStatus.mic)}>麦克风：{statusLabel(proctorStatus.mic)}</Tag>
                    <Tag color={statusColor(proctorStatus.face)}>人脸：{statusLabel(proctorStatus.face)}</Tag>
                    <Tag color={statusColor(proctorStatus.light)}>光线：{statusLabel(proctorStatus.light)}</Tag>
                    <Tag color={statusColor(proctorStatus.audio)}>声音：{statusLabel(proctorStatus.audio)}</Tag>
                  </Space>
                  <Space size="small" wrap>
                    <Text type="secondary">警告次数：{proctorStatus.warnings}</Text>
                    <Button size="small" onClick={restartProctoring}>
                      重新检测
                    </Button>
                  </Space>
                  {proctorStatus.lastEvent && (
                    <Text type="secondary">
                      最近：{proctorStatus.lastEvent.message || proctorStatus.lastEvent.type}
                    </Text>
                  )}
                </Space>
              </Card>
            )}
            <Card
              title={
                <Space>
                  <Text strong>答题卡</Text>
                  <Tag color="blue">
                    已答 {answeredCount}/{total}
                  </Tag>
                </Space>
              }
              style={{ borderRadius: 12 }}
            >
              {antiCheat.level !== 'none' && (
                <Alert
                  type={antiCheat.level === 'strict' ? 'error' : 'warning'}
                  showIcon
                  style={{ marginBottom: 12 }}
                  message={`防作弊模式：${antiCheatLabels[antiCheat.level]}`}
                  description={
                    Number.isFinite(antiCheat.maxSwitches)
                      ? `已记录 ${violationCount} 次异常切换，达到 ${antiCheat.maxSwitches} 次${
                          antiCheat.autoSubmit ? '将自动提交试卷' : '将被标记'
                        }。`
                      : '请保持考试窗口在最前，勿复制试题。'
                  }
                />
              )}
              <Row gutter={[8, 8]}>
                {exam.questions.map((q, idx) => {
                  const a = answers[q.id]
                  const answered = isShort(q.type) ? (a ?? '').trim().length > 0 : !!a
                  const mark = flagged.has(q.id)
                  return (
                    <Col span={4} key={q.id}>
                      <Button
                        block
                        size="small"
                        type={answered ? 'primary' : 'default'}
                        danger={mark}
                        onClick={() => scrollTo(q.id)}
                        style={{ borderRadius: 8, padding: 0, height: 32 }}
                        title={mark ? '已标记' : undefined}
                      >
                        {idx + 1}
                      </Button>
                    </Col>
                  )
                })}
              </Row>

              <Divider style={{ margin: '12px 0' }} />
              <Space wrap>
                <Tag color="blue">已答</Tag>
                <Tag>未答</Tag>
                <Tag color="error">标记</Tag>
              </Space>

              <Divider style={{ margin: '12px 0' }} />
              <Button
                type="primary"
                block
                icon={<Send size={16} />}
                onClick={() => doSubmit(false)}
                loading={submitting}
              >
                提交答卷
              </Button>
            </Card>
          </div>
        </Col>
      </Row>
    </div>
  )
}
