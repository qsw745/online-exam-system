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
import { useLanguage } from '@/shared/contexts/LanguageContext'
import { tasksApi } from '@/shared/api/endpoints/tasks'
import { isSuccess } from '@/shared/api/http'
import { useStrictProctoring, type ExamProctoringPolicy } from '@/features/exams/proctoring/useStrictProctoring'
import { StrictProctoringGate } from '@/features/exams/proctoring/StrictProctoringGate'
import { StrictProctoringStatusCard } from '@/features/exams/proctoring/StrictProctoringStatusCard'
import { sanitizeHtml } from '@/shared/utils/sanitizeHtml'
import { useAuth } from '@/shared/contexts/AuthContext'
import { useExamDraft } from '@/features/exams/hooks/useExamDraft'
import type { ExamDraftState } from '@/features/exams/draft/examDraft'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import {
  createAuthoritativeDeadlineClock,
  createPendingSubmission,
  remainingSeconds,
  type AuthoritativeDeadlineClock,
  type PendingExamSubmission,
  type PendingSubmissionReason,
} from '@/features/exams/reliability/examReliability'
import { resolveExamVaultAdapter } from '@/platform/exam-vault'
import {
  clearExamSession,
  readExamSession,
  restoreCachedServerNow,
  saveExamSession,
} from '@/features/exams/reliability/examSessionCache'

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
  attemptId: string
  duration: number
  status: 'in_progress' | 'not_started' | 'submitted' | 'graded'
  startedAt?: string | null
  endTime?: string | null
  deadlineAt: string
  serverNow: string
  title: string
  description?: string | null
  questions: Question[]
  antiCheat?: AntiCheatConfig
  proctoring?: ExamProctoringPolicy
}

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input
type TranslateFn = (key: string, fallback?: string) => string

const formatText = (template: string, values: Record<string, string | number | null | undefined> = {}) =>
  Object.entries(values).reduce((next, [key, value]) => next.replaceAll(`{${key}}`, String(value ?? '')), template)

const antiCheatLabel = (level: AntiCheatConfig['level'], t: TranslateFn) => t(`examPage.antiCheat.${level}`, level)

const letter = (i: number) => String.fromCharCode(65 + i)
const isSingle = (t: string) => ['single', 'single_choice'].includes(t?.toLowerCase())
const isMulti = (t: string) => ['multiple', 'multiple_choice'].includes(t?.toLowerCase())
const isTF = (t: string) => ['true_false', 'judge', 'tf'].includes(t?.toLowerCase())
const isShort = (t: string) => ['short', 'short_answer', 'essay', 'text', 'fill_blank'].includes(t?.toLowerCase())

function ensureTfOptions(q: Question, t: TranslateFn) {
  if (isTF(q.type)) return [t('examPage.true'), t('examPage.false')]
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
  const { t } = useLanguage()
  const normalized = type.toLowerCase()
  if (isSingle(normalized)) return <Tag color="blue">{t('questions.type_single')}</Tag>
  if (isMulti(normalized)) return <Tag color="purple">{t('questions.type_multiple')}</Tag>
  if (isTF(normalized)) return <Tag color="green">{t('questions.type_true_false')}</Tag>
  if (isShort(normalized)) return <Tag color="gold">{t('questions.type_short')}</Tag>
  return <Tag>{t('examPage.question')}</Tag>
}

export default function ExamPage() {
  // /exam/:id —— 这里的 id 可能是 examId，也可能是 taskId（后端已兼容）
  const routeParams = useParams<{ id?: string; taskId?: string }>()
  const id = routeParams.id || routeParams.taskId || ''
  const location = useLocation() as any
  const navigate = useNavigate()
  const { message } = App.useApp()
  const { t } = useLanguage()
  const { user } = useAuth()
  const isOnline = useOnlineStatus()
  const examVault = React.useMemo(() => resolveExamVaultAdapter(), [])
  const examSessionIdentity = React.useMemo(
    () => user?.id && id ? { userId: user.id, routeId: id } : null,
    [id, user?.id],
  )

  const [loading, setLoading] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)
  const [exam, setExam] = React.useState<ExamPayload | null>(() => {
    const s = location?.state
    if (
      s &&
      typeof s === 'object' &&
      Array.isArray(s.questions) &&
      s.examId &&
      s.attemptId &&
      s.deadlineAt &&
      s.serverNow
    ) {
      s.questions = (s.questions as Question[]).map(q => ({
        ...q,
        options: isTF(q.type) ? ensureTfOptions(q, t) : Array.isArray(q.options) ? q.options : q.options ?? [],
      }))
      return s as ExamPayload
    }
    return null
  })

  /** 答案存储：单选/判断：'A'；多选：'A,B,D'；主观题：文本字符串 */
  const [answers, setAnswers] = React.useState<Record<number, string>>({})
  const [flagged, setFlagged] = React.useState<Set<number>>(new Set())
  const [pendingSubmission, setPendingSubmission] = React.useState<PendingExamSubmission | null>(null)
  const [timeLeft, setTimeLeft] = React.useState<number>(0) // 秒
  const deadlineClockRef = React.useRef<AuthoritativeDeadlineClock | null>(null)
  const deadlineHandledRef = React.useRef(false)
  const submissionInFlightRef = React.useRef(false)
  const draftIdentity = React.useMemo(() => {
    if (!user?.id || !exam?.taskId || !exam?.examId || !exam.attemptId) return null
    return { userId: user.id, taskId: exam.taskId, examId: exam.examId, attemptId: exam.attemptId }
  }, [exam?.attemptId, exam?.examId, exam?.taskId, user?.id])
  const restoreDraft = React.useCallback((state: ExamDraftState) => {
    setAnswers(Object.fromEntries(Object.entries(state.answers).map(([key, value]) => [Number(key), value])))
    setFlagged(new Set(state.flagged))
    setPendingSubmission(state.pendingSubmission ?? null)
  }, [])
  const flaggedQuestionIds = React.useMemo(() => [...flagged], [flagged])
  const { status: draftStatus, savedAt, ready: draftReady, clearDraft, flushDraft } = useExamDraft({
    identity: draftIdentity,
    answers,
    flagged: flaggedQuestionIds,
    pendingSubmission,
    onRestore: restoreDraft,
  })
  const antiCheat = exam?.antiCheat ?? {
    level: 'none' as AntiCheatConfig['level'],
    maxSwitches: Number.MAX_SAFE_INTEGER,
    autoSubmit: false,
  }
  const proctoring = React.useMemo<ExamProctoringPolicy>(() => exam?.proctoring ?? {
    enabled: false,
    level: 'off',
    requireCamera: false,
    requireMic: false,
    requireIdentityVerification: false,
    policyVersion: 'wenheng-proctoring-2026-08-v1',
    noticeVersion: 'wenheng-proctoring-notice-2026-08-v1',
    eventRetentionDays: 180,
    snapshotRetentionDays: 0,
    heartbeatIntervalSeconds: 15,
    interruptionGraceSeconds: 45,
  }, [exam?.proctoring])
  const strictProctoring = useStrictProctoring({
    examId: exam?.examId,
    attemptId: exam?.attemptId,
    policy: proctoring,
    isOnline,
  })

  /** 拉取试卷 */
  React.useEffect(() => {
    let alive = true
    const boot = async () => {
      try {
        if (!exam) {
          const res: any = await tasksApi.startExam(id)
          if (!alive) return
          if (!isSuccess(res)) throw new Error(res?.message || t('examPage.messages.load_failed'))
          const data = (res.data ?? res) as ExamPayload
          if (!data.attemptId || !data.serverNow || !data.deadlineAt) {
            throw new Error('考试服务尚未完成可靠性升级，请联系管理员完成数据库迁移。')
          }
          data.questions = (data.questions || []).map(q => ({
            ...q,
            options: isTF(q.type) ? ensureTfOptions(q, t) : Array.isArray(q.options) ? q.options : q.options ?? null,
          }))
          if (examVault && examSessionIdentity && examVault.systemUptimeMs) {
            try {
              const uptime = await examVault.systemUptimeMs()
              await saveExamSession(examVault, examSessionIdentity, data, uptime)
            } catch {
              // 会话缓存失败不阻断在线考试，草稿层会单独提示存储状态。
            }
          }
          setExam(data)
          if (data.status === 'submitted' || data.status === 'graded') {
            if (examVault && examSessionIdentity) await clearExamSession(examVault, examSessionIdentity)
            message.info(t('examPage.messages.already_submitted'))
            navigate(`/results/${data.examId}`, { replace: true })
            return
          }
        }
      } catch (e: any) {
        let restored = false
        if (examVault && examSessionIdentity && examVault.systemUptimeMs) {
          try {
            const cached = await readExamSession<ExamPayload>(examVault, examSessionIdentity)
            if (cached.status === 'found') {
              const currentUptime = await examVault.systemUptimeMs()
              const timing = restoreCachedServerNow(
                cached.session.payload.serverNow,
                cached.session.deviceUptimeMs,
                currentUptime,
              )
              if (timing.ok) {
                const data = { ...cached.session.payload, serverNow: timing.serverNow }
                data.questions = (data.questions || []).map(q => ({
                  ...q,
                  options: isTF(q.type)
                    ? ensureTfOptions(q, t)
                    : Array.isArray(q.options)
                      ? q.options
                      : q.options ?? null,
                }))
                if (alive) {
                  setExam(data)
                  message.warning('当前离线，已从加密保险箱恢复考试。联网后将自动同步交卷。')
                }
                restored = true
              } else if (timing.reason === 'device_restarted') {
                message.error('设备重启后考试计时基准已失效，请联网重新校准后继续。')
              }
            }
          } catch {
            // 下方统一显示在线加载错误。
          }
        }
        if (!restored) message.error(e?.message || t('examPage.messages.load_failed'))
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

  /** 倒计时只使用本次服务端同步值和 performance.now()，不受用户修改系统时间影响。 */
  React.useEffect(() => {
    if (!exam) return
    const clock = createAuthoritativeDeadlineClock({
      serverNow: exam.serverNow,
      deadlineAt: exam.deadlineAt,
    })
    deadlineClockRef.current = clock
    deadlineHandledRef.current = false

    const tick = () => {
      const sec = remainingSeconds(clock)
      setTimeLeft(sec)
      if (
        sec <= 0 &&
        draftReady &&
        (!strictProctoring.required || strictProctoring.canAnswer) &&
        !deadlineHandledRef.current
      ) {
        deadlineHandledRef.current = true
        void doSubmitRef.current(true, 'deadline')
      }
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [draftReady, exam, strictProctoring.canAnswer, strictProctoring.required])

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

  const currentTimeSpent = React.useCallback(() => {
    if (!exam?.startedAt) return 0
    const elapsedAtSync = Math.max(0, Date.parse(exam.serverNow) - Date.parse(exam.startedAt))
    const clock = deadlineClockRef.current
    const elapsedSinceSync = clock ? Math.max(0, performance.now() - clock.syncedMonotonicMs) : 0
    return Math.min(exam.duration * 60, Math.floor((elapsedAtSync + elapsedSinceSync) / 1000))
  }, [exam])

  const doSubmit = async (auto = false, reason: PendingSubmissionReason = 'manual') => {
    if (!exam || submissionInFlightRef.current) return
    if (strictProctoring.required && (!strictProctoring.canAnswer || !isOnline)) {
      message.error('严格监考状态必须正常且保持联网后才能交卷。')
      return
    }
    try {
      if (!auto && !pendingSubmission) {
        const ok = await new Promise<boolean>(resolve => {
          Modal.confirm({
            title: t('examPage.submit_confirm.title'),
            content: formatText(t('examPage.submit_confirm.content'), { answered: answeredCount, total }),
            okText: t('app.submit'),
            cancelText: t('examPage.submit_confirm.cancel'),
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
          })
        })
        if (!ok) return
      }

      submissionInFlightRef.current = true
      const snapshot = pendingSubmission ?? createPendingSubmission({
        attemptId: exam.attemptId,
        answers,
        timeSpent: currentTimeSpent(),
        reason,
      })
      setPendingSubmission(snapshot)
      await flushDraft({
        answers: Object.fromEntries(Object.entries(answers).map(([key, value]) => [String(key), value])),
        flagged: flaggedQuestionIds,
        pendingSubmission: snapshot,
      })

      if (!isOnline) {
        if (!auto) message.warning('当前网络不可用，交卷已安全排队，恢复联网后会自动提交。')
        return
      }

      setSubmitting(true)
      const res: any = await tasksApi.submit(exam.taskId, {
        attemptId: snapshot.attemptId,
        submissionId: snapshot.submissionId,
        answers: snapshot.answers,
        time_spent: snapshot.timeSpent,
      })
      if (!isSuccess(res)) {
        if (res?.code === 'EXAM_ALREADY_SUBMITTED') {
          await clearDraft()
          if (examVault && examSessionIdentity) await clearExamSession(examVault, examSessionIdentity)
          setPendingSubmission(null)
          message.info(t('examPage.messages.already_submitted'))
          navigate(`/results/${exam.examId}`, { replace: true })
          return
        }
        const error = new Error(res?.error || t('examPage.messages.submit_failed')) as Error & { code?: string }
        error.code = res?.code
        throw error
      }
      if (strictProctoring.required) {
        try {
          await strictProctoring.complete()
        } catch (proctoringError: any) {
          message.warning(
            `答卷已提交，但监考会话结束确认失败，将由服务端进入复核：${proctoringError?.message || 'UNKNOWN'}`,
          )
        }
      }
      await clearDraft()
      if (examVault && examSessionIdentity) await clearExamSession(examVault, examSessionIdentity)
      setPendingSubmission(null)
      if (!auto) message.success(t('examPage.messages.submit_success'))
      navigate(`/results/${exam.examId}`)
    } catch (e: any) {
      message.error(
        `${e?.message || t('examPage.messages.submit_failed')}。交卷快照仍保存在本机，可稍后重试。`,
      )
    } finally {
      submissionInFlightRef.current = false
      setSubmitting(false)
    }
  }
  const doSubmitRef = React.useRef<(
    auto?: boolean,
    reason?: PendingSubmissionReason,
  ) => Promise<void>>(async () => {})
  React.useEffect(() => {
    doSubmitRef.current = doSubmit
  }, [doSubmit])

  const recoveryAttemptedRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (!isOnline) {
      recoveryAttemptedRef.current = null
      return
    }
    if (
      !pendingSubmission ||
      (strictProctoring.required && !strictProctoring.canAnswer) ||
      recoveryAttemptedRef.current === pendingSubmission.submissionId
    ) return
    recoveryAttemptedRef.current = pendingSubmission.submissionId
    void doSubmitRef.current(true, pendingSubmission.reason)
  }, [isOnline, pendingSubmission, strictProctoring.canAnswer, strictProctoring.required])
  const violationRef = React.useRef(0)
  const [violationCount, setViolationCount] = React.useState(0)

  React.useEffect(() => {
    violationRef.current = 0
    setViolationCount(0)
  }, [antiCheat.level])

  React.useEffect(() => {
    if (!exam || antiCheat.level === 'none' || !draftReady || !strictProctoring.canAnswer) return
    const limit = antiCheat.maxSwitches && Number.isFinite(antiCheat.maxSwitches)
      ? antiCheat.maxSwitches
      : antiCheat.level === 'strict'
      ? 1
      : 3

    const handleViolation = (reason: string) => {
      violationRef.current += 1
      setViolationCount(violationRef.current)
      const remaining = Math.max(0, limit - violationRef.current)
      message.warning(`${reason}${remaining < Number.MAX_SAFE_INTEGER ? formatText(t('examPage.violations.remaining'), { count: remaining }) : ''}`)
      if (violationRef.current >= limit) {
        message.error(t('examPage.antiCheat.return_to_exam'))
      }
    }

    const handleBlur = () => handleViolation(t('examPage.violations.window_blur'))
    const handleVisibility = () => {
      if (document.hidden) handleViolation(t('examPage.violations.tab_hidden'))
    }
    const handleCopy = (e: ClipboardEvent) => {
      if (antiCheat.disableCopy) {
        e.preventDefault()
        message.warning(t('examPage.violations.copy_blocked'))
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
    draftReady,
    message,
    strictProctoring.canAnswer,
    t,
  ])

  /** ---------------- UI 渲染 ---------------- */
  if (loading) return <LoadingSpinner center="page" text={t('app.loading')} />

  if (!exam) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Result
          status="404"
          title={t('examPage.not_found.title')}
          subTitle={t('examPage.not_found.subtitle')}
          icon={<AlertTriangle className="w-12 h-12 text-red-500" />}
          extra={
            <Button type="primary" onClick={() => navigate('/dashboard')}>
              {t('app.home')}
            </Button>
          }
        />
      </div>
    )
  }

  const mm = Math.floor(timeLeft / 60)
  const ss = (timeLeft % 60).toString().padStart(2, '0')
  const percent = Math.max(0, Math.min(100, ((exam.duration * 60 - timeLeft) / (exam.duration * 60)) * 100))

  return (
    <div className="exam-page" style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
      <StrictProctoringGate
        policy={proctoring}
        phase={strictProctoring.phase}
        busy={strictProctoring.busy}
        error={strictProctoring.error}
        onBegin={strictProctoring.begin}
        onOpenSettings={strictProctoring.openSettings}
        onExit={() => navigate('/dashboard')}
      />
      {/* 顶部栏（固定） */}
      <div style={{ position: 'sticky', top: 0, zIndex: 30 }}>
        <Card className="exam-top-card" styles={{ body: { padding: 12 } }} style={{ borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,.04)' }}>
          <Row gutter={[12, 12]} align="middle">
            <Col flex="auto">
              <Space direction="vertical" size={0}>
                <Title level={4} style={{ margin: 0 }}>
                  {exam.title}
                </Title>
                {exam.description ? <Text type="secondary">{exam.description}</Text> : null}
                <Space size="small" wrap style={{ marginTop: 4 }}>
                  <Tag color={antiCheat.level === 'strict' ? 'red' : antiCheat.level === 'basic' ? 'orange' : 'default'}>
                    {formatText(t('examPage.antiCheat.label'), { level: antiCheatLabel(antiCheat.level, t) })}
                  </Tag>
                  {antiCheat.level !== 'none' && Number.isFinite(antiCheat.maxSwitches) ? (
                    <Text type="secondary">{formatText(t('examPage.antiCheat.allowed_switches'), { count: antiCheat.maxSwitches })}</Text>
                  ) : null}
                </Space>
              </Space>
            </Col>
            <Col>
              <Space className="exam-submit-actions" size={16} align="center" wrap>
                <Space>
                  <Clock size={18} />
                  <Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {mm}:{ss}
                  </Text>
                </Space>
                <Progress type="circle" size={44} percent={parseFloat(percent.toFixed(1))} />
                <Button
                  type="primary"
                  icon={<Send size={16} />}
                  onClick={() => doSubmit(false)}
                  loading={submitting}
                  disabled={submitting || !draftReady || !strictProctoring.canAnswer}
                >
                  {pendingSubmission ? '重试交卷' : t('app.submit')}
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>
      </div>

      <div className="exam-save-status">
        {draftStatus === 'unavailable' ? (
          <Alert type="error" showIcon message="无法使用本机加密保险箱" description="为避免答案丢失，已暂停作答。请检查设备存储后重新进入考试。" />
        ) : !draftReady ? (
          <Alert type="info" showIcon message="正在恢复加密草稿" description="完成前暂不允许修改答案或交卷。" />
        ) : pendingSubmission ? (
          <Alert
            type="info"
            showIcon
            message={isOnline ? '正在确认交卷' : '交卷已安全排队'}
            description={isOnline ? '正在使用同一提交编号确认结果，请勿退出。' : '恢复联网后将自动提交，期间不会改变已排队的答案。'}
          />
        ) : !isOnline ? (
          <Alert type="warning" showIcon message="当前网络不可用" description="答案会加密保存在本机；你仍可点击交卷并排队等待联网。" />
        ) : draftStatus === 'saved' ? (
          <Text type="secondary">答案已保存{savedAt ? ` · ${dayjs(savedAt).format('HH:mm:ss')}` : ''}</Text>
        ) : null}
      </div>

      <Divider />

      <Row gutter={[12, 12]} align="top">
        {/* 左侧：题目列表 */}
        <Col xs={24} lg={17}>
          {exam.questions.length === 0 ? (
            <Empty description={t('examPage.no_questions')} />
          ) : (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              {exam.questions.map((q, idx) => {
                const qno = idx + 1
                const valueParsed = parseAnswerValue(q, answers[q.id])
                const opts = isTF(q.type) ? ensureTfOptions(q, t) : Array.isArray(q.options) ? q.options : []

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
                            <Text strong>{formatText(t('examPage.question_number'), { number: qno })}</Text>
                            <TypeTag type={q.type} />
                            <Tag color="gold">{formatText(t('examPage.score'), { score: q.score })}</Tag>
                          </Space>
                        </Col>
                        <Col>
                          <Button
                            size="small"
                            type={flagged.has(q.id) ? 'default' : 'text'}
                            disabled={Boolean(pendingSubmission) || !draftReady || !strictProctoring.canAnswer}
                            icon={<Flag size={16} color={flagged.has(q.id) ? '#faad14' : undefined} />}
                            onClick={() => toggleFlag(q.id)}
                          >
                            {flagged.has(q.id) ? t('examPage.flagged') : t('examPage.flag')}
                          </Button>
                        </Col>
                      </Row>
                    }
                  >
                    <Paragraph style={{ marginBottom: 16 }}>
                      <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(q.content || '') }} />
                    </Paragraph>

                    {/* 渲染不同题型 */}
                    {isShort(q.type) ? (
                      <TextArea
                        autoSize={{ minRows: 3, maxRows: 8 }}
                        value={valueParsed as string}
                        placeholder={t('examPage.answer_placeholder')}
                        disabled={Boolean(pendingSubmission) || !draftReady || !strictProctoring.canAnswer}
                        onChange={e => setAnswer(q, e.target.value)}
                      />
                    ) : isMulti(q.type) ? (
                      <Checkbox.Group
                        value={valueParsed as string[]}
                        disabled={Boolean(pendingSubmission) || !draftReady || !strictProctoring.canAnswer}
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
                        disabled={Boolean(pendingSubmission) || !draftReady || !strictProctoring.canAnswer}
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
          <div className="exam-side-panel" style={{ position: 'sticky', top: 92 }}>
            {proctoring.enabled && (
              <StrictProctoringStatusCard
                phase={strictProctoring.phase}
                status={strictProctoring.status}
                error={strictProctoring.error}
              />
            )}
            <Card
              title={
                <Space>
                  <Text strong>{t('examPage.answer_card')}</Text>
                  <Tag color="blue">
                    {formatText(t('examPage.answered_count'), { answered: answeredCount, total })}
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
                  message={formatText(t('examPage.antiCheat.mode'), { level: antiCheatLabel(antiCheat.level, t) })}
                  description={
                    Number.isFinite(antiCheat.maxSwitches)
                      ? formatText(t('examPage.antiCheat.switch_marked'), {
                          count: violationCount,
                          limit: antiCheat.maxSwitches,
                        })
                      : t('examPage.antiCheat.keep_front')
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
                        title={mark ? t('examPage.flagged') : undefined}
                      >
                        {idx + 1}
                      </Button>
                    </Col>
                  )
                })}
              </Row>

              <Divider style={{ margin: '12px 0' }} />
              <Space wrap>
                <Tag color="blue">{t('examPage.answered')}</Tag>
                <Tag>{t('examPage.unanswered')}</Tag>
                <Tag color="error">{t('examPage.flag')}</Tag>
              </Space>

              <Divider style={{ margin: '12px 0' }} />
              <Button
                type="primary"
                block
                icon={<Send size={16} />}
                onClick={() => doSubmit(false)}
                loading={submitting}
                disabled={submitting || !draftReady || !strictProctoring.canAnswer}
              >
                {pendingSubmission ? '重试交卷' : t('examPage.submit_paper')}
              </Button>
            </Card>
          </div>
        </Col>
      </Row>
    </div>
  )
}
