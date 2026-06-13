import { App, Badge, Button, Drawer, FloatButton, Input, List, Modal, Select, Space, Tag, Tooltip, Typography } from 'antd'
import {
  AudioOutlined,
  CheckCircleOutlined,
  ClearOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  HistoryOutlined,
  MessageOutlined,
  PaperClipOutlined,
  PlusOutlined,
  RobotOutlined,
  SendOutlined,
  ThunderboltOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { aiApi } from '@/shared/api/endpoints/ai'
import { systemTestsApi } from '@/shared/api/endpoints/system-tests'
import { mailApi } from '@/shared/api/endpoints/mail'
import { papersApi } from '@/shared/api/endpoints/papers'
import { workflowsApi } from '@/shared/api/endpoints/workflows'
import { orgsApi } from '@/shared/api/endpoints/orgs'
import { rolesApi } from '@/shared/api/endpoints/roles'
import { tasksApi } from '@/shared/api/endpoints/tasks'
import { usersApi } from '@/shared/api/endpoints/users'
import { api, getErr, isSuccess } from '@/shared/api/http'
import { useAuth } from '@/shared/contexts/AuthContext'
import { redirectToLogin } from '@/shared/router/basePath'
import './AiAssistantWidget.css'

const { Text } = Typography
const { TextArea } = Input

type ChatRole = 'user' | 'assistant' | 'system'
type AgentAction = { type: string; payload?: any }
type ChatItem = { id: string; role: ChatRole; content: string; action?: AgentAction }
type ChatSession = { id: string; title: string; items: ChatItem[]; createdAt: number; updatedAt: number }
type ExecutionMode = 'request' | 'review' | 'auto'
type ExecuteOptions = { confirmation?: 'ask' | 'skip'; automated?: boolean }
type AttachmentStatus = 'processing' | 'ready' | 'error'
type AssistantAttachment = {
  id: string
  name: string
  mime: string
  status: AttachmentStatus
  text?: string
  error?: string
}
type BrowserSpeechRecognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: any) => void) | null
  onerror: ((event: any) => void) | null
  onend: (() => void) | null
}

const HELLO_ITEM: ChatItem = {
  id: 'hello',
  role: 'assistant',
  content: '你好！我可以帮你查找功能、生成题目、给出学习建议。',
}

const createSession = (): ChatSession => {
  const now = Date.now()
  return { id: String(now), title: '新对话', items: [HELLO_ITEM], createdAt: now, updatedAt: now }
}

const normalizeItems = (items: any[]): ChatItem[] =>
  items.map((i: any) => ({
    id: String(i.id || Date.now()),
    role: i.role === 'assistant' || i.role === 'system' ? i.role : 'user',
    content: String(i.content || ''),
    action: i.action,
  }))

const normalizeSession = (s: any): ChatSession => {
  const now = Date.now()
  return {
    id: String(s.id || now),
    title: String(s.title || '新对话'),
    items: Array.isArray(s.items) ? normalizeItems(s.items) : [HELLO_ITEM],
    createdAt: Number(s.createdAt || now),
    updatedAt: Number(s.updatedAt || now),
  }
}

const passwordKinds = (value: string) =>
  [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z0-9]/].reduce((n, r) => n + (r.test(value) ? 1 : 0), 0)

const generatePassword = (length = 12) => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnopqrstuvwxyz'
  const digits = '23456789'
  const symbols = '!@#$%^&*_-+=?'
  const pools = [upper, lower, digits, symbols]
  const all = pools.join('')
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)]
  let pwd = pools.map(pick).join('')
  while (pwd.length < length) pwd += pick(all)
  const arr = pwd.split('')
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }
  return arr.join('')
}

const ACTION_LABELS: Record<string, string> = {
  navigate: '页面跳转',
  open_url: '打开链接',
  send_mail: '发送邮件',
  generate_questions: '生成题目',
  create_paper: '生成试卷',
  create_task: '创建任务',
  create_user: '创建用户',
  create_org: '创建部门',
  assign_role: '分配角色',
  update_paper: '修改试卷',
  suggest_paper: '组卷建议',
  study_plan: '学习计划',
  explain_question: '题目解析',
  summarize_exam: '考试总结',
  change_password: '修改密码',
  reset_password: '重置密码',
  run_test: '系统测速',
}

const QUICK_COMMANDS = [
  { label: '生成题目', prompt: '帮我生成 10 道中等难度单选题，主题是本周课程重点，先给预览，不入库。' },
  { label: '智能组卷', prompt: '按中等难度生成一份 20 题、100 分、60 分钟的试卷，并在生成后带我去查看。' },
  { label: '审批流程', prompt: '查看我待处理的审批任务，并说明每个任务需要我做什么。' },
  { label: '学习计划', prompt: '根据我的薄弱知识点生成 4 周学习计划，按周列出训练重点。' },
  { label: '系统测速', prompt: '运行一次系统测速，覆盖 users、questions、exams、notifications、mail。' },
]

const HIGH_IMPACT_ACTIONS = new Set([
  'send_mail',
  'open_url',
  'generate_questions',
  'create_paper',
  'create_task',
  'create_user',
  'create_org',
  'assign_role',
  'update_paper',
  'change_password',
  'reset_password',
  'run_test',
])

const MODEL_OPTIONS = [
  { label: '默认模型', value: '' },
  { label: 'OpenAI · gpt-4o-mini', value: 'gpt-4o-mini' },
  { label: 'OpenAI · gpt-4o', value: 'gpt-4o' },
  { label: 'OpenAI · gpt-4.1-mini', value: 'gpt-4.1-mini' },
  { label: 'OpenAI · gpt-5.1-all', value: 'gpt-5.1-all' },
  { label: 'OpenAI · gpt-5.1-thinking', value: 'gpt-5.1-thinking' },
  { label: 'OpenAI · gpt-5.1-thinking-all', value: 'gpt-5.1-thinking-all' },
  { label: 'OpenAI · gpt-5.2-all', value: 'gpt-5.2-all' },
  { label: 'OpenAI · gpt-5.2-thinking', value: 'gpt-5.2-thinking' },
  { label: 'OpenAI · gpt-5.2-thinking-all', value: 'gpt-5.2-thinking-all' },
  { label: 'Claude · claude-4.5-haiku', value: 'claude-4.5-haiku' },
  { label: 'Claude · claude-sonnet-4.5', value: 'claude-sonnet-4.5' },
  { label: 'Claude · claude-4.5-opus', value: 'claude-4.5-opus' },
  { label: 'Claude · claude-opus-4', value: 'claude-opus-4' },
  { label: 'Gemini · gemini-2.5-pro', value: 'gemini-2.5-pro' },
  { label: 'Gemini · gemini-3-pro-preview', value: 'gemini-3-pro-preview' },
  { label: 'Gemini · gemini-3-pro-preview-maxthinking', value: 'gemini-3-pro-preview-maxthinking' },
  { label: 'Gemini · gemini-3-flash-preview', value: 'gemini-3-flash-preview' },
  { label: 'DeepSeek · deepseek-v4-flash', value: 'deepseek-v4-flash' },
  { label: 'DeepSeek · deepseek-v4-pro', value: 'deepseek-v4-pro' },
  { label: '通义 · qwen3-max', value: 'qwen3-max' },
  { label: '豆包 · doubao-seed-1.6-thinking', value: 'doubao-seed-1.6-thinking' },
  { label: '通义 · qwen-turbo', value: 'qwen-turbo' },
  { label: '通义 · qwen-plus', value: 'qwen-plus' },
  { label: '智谱 · glm-4', value: 'glm-4' },
  { label: 'Moonshot · kimi-k2', value: 'kimi-k2' },
]

const QUESTION_BATCH_SIZE =
  Number((typeof import.meta !== 'undefined' && (import.meta as any)?.env?.VITE_AI_QUESTION_BATCH_SIZE) || 10) || 10
const QUESTION_BATCH_MAX =
  Number((typeof import.meta !== 'undefined' && (import.meta as any)?.env?.VITE_AI_QUESTION_BATCH_MAX) || 20) || 20

const EXECUTION_MODE_STORAGE_KEY = 'ai-assistant:execution-mode'

const EXECUTION_MODE_META: Record<
  ExecutionMode,
  { label: string; shortLabel: string; description: string; color: string }
> = {
  request: {
    label: '请求执行',
    shortLabel: '请求',
    description: '助手只生成动作卡片，由你点击执行；高风险动作仍会二次确认。',
    color: 'default',
  },
  review: {
    label: '审核执行',
    shortLabel: '审核',
    description: '低风险动作自动执行；高风险动作自动弹出审核确认后再执行。',
    color: 'processing',
  },
  auto: {
    label: '完全执行',
    shortLabel: '自动',
    description: '动作返回后直接执行；权限、登录、必填参数和密码强度校验仍然保留。',
    color: 'success',
  },
}

const EXECUTION_MODE_OPTIONS = (Object.entries(EXECUTION_MODE_META) as Array<[ExecutionMode, typeof EXECUTION_MODE_META[ExecutionMode]]>).map(
  ([value, meta]) => ({
    label: meta.label,
    value,
  })
)

const normalizeExecutionMode = (value: unknown): ExecutionMode =>
  value === 'review' || value === 'auto' || value === 'request' ? value : 'request'

const readExecutionMode = (): ExecutionMode => {
  if (typeof window === 'undefined') return 'request'
  return normalizeExecutionMode(window.localStorage.getItem(EXECUTION_MODE_STORAGE_KEY))
}

const TEXT_FILE_EXTENSIONS = new Set(['txt', 'md', 'markdown', 'csv', 'json', 'log', 'xml', 'html', 'htm', 'yaml', 'yml'])
const MAX_ATTACHMENT_CHARS = 12000
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024

const getFileExtension = (name: string) => String(name || '').split('.').pop()?.toLowerCase() || ''

const isTextFile = (file: File) =>
  file.type.startsWith('text/') ||
  file.type === 'application/json' ||
  file.type === 'application/xml' ||
  TEXT_FILE_EXTENSIONS.has(getFileExtension(file.name))

const truncateAttachmentText = (text: string) => {
  const clean = String(text || '').replace(/\r\n/g, '\n').trim()
  if (clean.length <= MAX_ATTACHMENT_CHARS) return clean
  return `${clean.slice(0, MAX_ATTACHMENT_CHARS)}\n\n[内容过长，已截取前 ${MAX_ATTACHMENT_CHARS} 字]`
}

const getSpeechRecognitionCtor = () => {
  if (typeof window === 'undefined') return null
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null
}

function actionSummary(action: AgentAction): string {
  const p = action.payload || {}
  switch (action.type) {
    case 'navigate':
      return `跳转到 ${p.path || '/'}`
    case 'open_url':
      return `打开链接 ${p.url || ''}`
    case 'generate_questions':
      return `生成题目 ${p.count ?? ''} ${p.question_type ?? ''}`.trim()
    case 'create_paper':
      return `生成试卷 ${p.totalQuestions ?? ''} 题`.trim()
    case 'create_task':
      return `创建任务 ${p.title || ''}`.trim()
    case 'update_paper':
      return `修改试卷 ${p.paper_id ?? ''}`.trim()
    case 'create_user':
      return `创建用户 ${p.email || p.username || ''}`.trim()
    case 'create_org':
      return `创建部门 ${p.name || p.org_name || ''}`.trim()
    case 'assign_role':
      return `分配角色 ${p.role || p.role_name || p.role_code || ''}`.trim()
    case 'send_mail':
      return `发送邮件给 ${p.to_email || p.email || ''}`.trim()
    case 'suggest_paper':
      return `生成组卷建议（总题数 ${p.totalQuestions ?? '-'}）`
    case 'study_plan':
      return `生成学习计划 ${p.time_range ?? ''}`.trim()
    case 'explain_question':
      return `生成题目解析`
    case 'summarize_exam':
      return `生成考试总结`
    case 'change_password':
      return '修改当前账号密码'
    case 'reset_password':
      return '重置用户密码'
    case 'run_test':
      return '执行系统测速任务'
    default:
      return '执行操作'
  }
}

function needsConfirm(action: AgentAction): boolean {
  if (action.type === 'generate_questions' && !action.payload?.persist) return false
  return HIGH_IMPACT_ACTIONS.has(action.type)
}

export default function AiAssistantWidget() {
  const { message } = App.useApp()
  const inputRef = useRef<any>(null)
  const navigate = useNavigate()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [model, setModel] = useState<string>('')
  const [customModel, setCustomModel] = useState<string>('')
  const [executionMode, setExecutionMode] = useState<ExecutionMode>(() => readExecutionMode())
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const [hydrating, setHydrating] = useState(false)
  const [lastTouchedId, setLastTouchedId] = useState<string | null>(null)
  const [executingActionKey, setExecutingActionKey] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<AssistantAttachment[]>([])
  const [listening, setListening] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const saveTimer = useRef<number | null>(null)
  const speechRef = useRef<BrowserSpeechRecognition | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(EXECUTION_MODE_STORAGE_KEY, executionMode)
  }, [executionMode])

  useEffect(
    () => () => {
      speechRef.current?.abort?.()
    },
    []
  )

  const scrollToBottom = (smooth = false) => {
    const el = listRef.current
    if (!el) return
    const behavior = smooth ? 'smooth' : 'auto'
    el.scrollTo({ top: el.scrollHeight, behavior })
  }

  useEffect(() => {
    setLastTouchedId(null)
    if (!user?.id) {
      setSessions([createSession()])
      setActiveId('')
      return
    }
    let cancelled = false
    const load = async () => {
      setHydrating(true)
      try {
        const res: any = await aiApi.listSessions()
        if (!res?.success) throw new Error(res?.error || '加载历史失败')
        const list = Array.isArray(res?.data) ? res.data : []
        const next = list.length ? list.map(normalizeSession) : [createSession()]
        if (!cancelled) {
          setSessions(next)
          setActiveId(next[0]?.id || '')
        }
      } catch (e: any) {
        if (!cancelled) {
          setSessions([createSession()])
          setActiveId('')
          message.error(e?.message || '加载历史失败')
        }
      } finally {
        if (!cancelled) setHydrating(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  useEffect(() => {
    if (!activeId && sessions.length) setActiveId(sessions[0].id)
  }, [activeId, sessions])

  useEffect(() => {
    if (hydrating || !user?.id || !lastTouchedId) return
    const session = sessions.find(s => s.id === lastTouchedId)
    if (!session) return
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(async () => {
      try {
        const res: any = await aiApi.saveSession(session.id, { title: session.title, items: session.items })
        if (!res?.success) throw new Error(res?.error || '保存失败')
      } catch (e: any) {
        message.error(e?.message || '保存失败')
      }
    }, 400)
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [sessions, lastTouchedId, hydrating, user?.id])

  const activeSession = useMemo(
    () => sessions.find(s => s.id === activeId) || sessions[0],
    [sessions, activeId]
  )
  const items = activeSession?.items ?? [HELLO_ITEM]

  useEffect(() => {
    scrollToBottom(true)
  }, [items.length, loading])

  const trimmedItems = useMemo(
    () => items.map(i => ({ role: i.role, content: i.content })),
    [items]
  )

  const sessionOptions = useMemo(
    () =>
      [...sessions]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map(s => ({ label: s.title || '新对话', value: s.id })),
    [sessions]
  )

  const actionCount = useMemo(() => items.filter(i => !!i.action).length, [items])
  const lastAction = useMemo(() => [...items].reverse().find(i => !!i.action)?.action, [items])
  const currentModelLabel = customModel.trim() || model || '默认模型'
  const executionModeMeta = EXECUTION_MODE_META[executionMode]
  const attachmentBusy = attachments.some(item => item.status === 'processing')
  const readyAttachments = attachments.filter(item => item.status === 'ready' && item.text)

  const append = (item: ChatItem) => {
    setSessions(prev =>
      prev.map(s => {
        if (s.id !== activeSession?.id) return s
        const nextItems = [...s.items, item]
        const title =
          s.title === '新对话' && item.role === 'user'
            ? String(item.content || '').slice(0, 24) || s.title
            : s.title
        return { ...s, title, items: nextItems, updatedAt: Date.now() }
      })
    )
    if (activeSession?.id) setLastTouchedId(activeSession.id)
    setTimeout(() => scrollToBottom(false), 0)
  }

  const isAuthExpired = (err: any) => {
    const msg = String(err?.message || err?.error || '').toLowerCase()
    return msg.includes('jwt expired') || msg.includes('unauthorized') || msg.includes('401')
  }

  const promptReLogin = () => {
    Modal.confirm({
      title: '登录已过期',
      content: '需要重新登录后才能继续执行，是否跳转登录？',
      okText: '去登录',
      cancelText: '取消',
      onOk: () => redirectToLogin(),
    })
  }

  const promptChangePassword = () =>
    new Promise<{ current: string; next: string } | null>(resolve => {
      let current = ''
      let next = ''
      let confirm = ''
      Modal.confirm({
        title: '修改密码',
        content: (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Input.Password placeholder="当前密码" onChange={e => (current = e.target.value)} />
            <Input.Password placeholder="新密码（至少 8 位）" onChange={e => (next = e.target.value)} />
            <Input.Password placeholder="确认新密码" onChange={e => (confirm = e.target.value)} />
          </Space>
        ),
        okText: '确认修改',
        cancelText: '取消',
        onOk: () => {
          if (!current || !next) {
            message.error('请输入当前密码和新密码')
            return Promise.reject()
          }
          if (next.length < 8) {
            message.error('新密码至少 8 位')
            return Promise.reject()
          }
          if (next !== confirm) {
            message.error('两次输入的新密码不一致')
            return Promise.reject()
          }
          resolve({ current, next })
          return undefined
        },
        onCancel: () => resolve(null),
      })
    })

  const promptResetPassword = (initialTarget?: string) =>
    new Promise<{ target: string; password?: string } | null>(resolve => {
      let target = initialTarget || ''
      let password = ''
      let confirm = ''
      Modal.confirm({
        title: '重置用户密码',
        content: (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Input
              placeholder="用户邮箱或ID"
              defaultValue={initialTarget}
              onChange={e => (target = e.target.value)}
            />
            <Input.Password placeholder="自定义新密码（留空则用系统默认）" onChange={e => (password = e.target.value)} />
            <Input.Password placeholder="确认新密码" onChange={e => (confirm = e.target.value)} />
          </Space>
        ),
        okText: '确认重置',
        cancelText: '取消',
        onOk: () => {
          if (!String(target || '').trim()) {
            message.error('请输入用户邮箱或ID')
            return Promise.reject()
          }
          if (password) {
            if (password.length < 8) {
              message.error('新密码至少 8 位')
              return Promise.reject()
            }
            if (passwordKinds(password) < 2) {
              message.error('密码至少包含两类（大小写/数字/符号）')
              return Promise.reject()
            }
            if (password !== confirm) {
              message.error('两次输入的新密码不一致')
              return Promise.reject()
            }
          }
          resolve({ target: String(target).trim(), password: password || undefined })
          return undefined
        },
        onCancel: () => resolve(null),
      })
    })

  const normalizeUserTarget = (value: string) => {
    let cleaned = String(value || '').trim()
    if (cleaned.includes('@')) {
      cleaned = cleaned.replace(/\s+/g, '')
      cleaned = cleaned.replace(/[，,;；]+$/g, '')
    }
    return cleaned
  }

  const findCandidateUsers = async (target: string) => {
    const cleaned = normalizeUserTarget(target)
    if (!cleaned) return []
    const results: Array<{ id: number; label: string }> = []
    const seen = new Set<number>()
    const push = (id: number, label: string) => {
      if (!Number.isFinite(id) || id <= 0 || seen.has(id)) return
      seen.add(id)
      results.push({ id, label })
    }

    const asNumber = Number(cleaned)
    if (Number.isFinite(asNumber) && String(asNumber) === cleaned) {
      try {
        const res: any = await usersApi.getById(asNumber)
        if (isSuccess(res) && res.data) {
          const u = res.data as any
          push(Number(u.id), String(u.email || u.nickname || u.name || u.id))
        }
      } catch {}
      return results
    }

    let options: Awaited<ReturnType<typeof mailApi.recipientOptions>> = []
    try {
      options = await mailApi.recipientOptions(cleaned)
    } catch {}
    const emailLower = cleaned.toLowerCase()
    options.forEach(o => {
      const id = Number(o.id)
      const label = String(o.email || o.name || o.id)
      if (label && (label.toLowerCase() === emailLower || label.includes(cleaned))) push(id, label)
    })

    try {
      const list = await usersApi.list({ search: cleaned, email: cleaned, page: 1, limit: 10 })
      list.users.forEach(u => {
        const label = String(u.email || u.nickname || u.name || u.id)
        if (
          String(u.email || '').toLowerCase() === emailLower ||
          String(u.nickname || '').includes(cleaned) ||
          String(u.name || '').includes(cleaned)
        ) {
          push(Number(u.id), label)
        }
      })
    } catch {}

    if (!results.length && cleaned.includes('@')) {
      const at = cleaned.indexOf('@')
      const namePart = cleaned.slice(0, at).trim()
      const domainPart = cleaned.slice(at + 1).replace(/\W/g, '').trim()
      if (namePart.length >= 4) {
        try {
          const list = await usersApi.list({ search: namePart, page: 1, limit: 10 })
          list.users.forEach(u => {
            const email = String(u.email || '').toLowerCase()
            const label = String(u.email || u.nickname || u.name || u.id)
            if (!email) return
            const nameLower = namePart.toLowerCase()
            const matchName = email.startsWith(`${nameLower}@`)
            if (!matchName) return
            if (domainPart.length >= 2 && !email.includes(`@${domainPart.toLowerCase()}`)) return
            push(Number(u.id), label)
          })
        } catch {}
      }
    }

    return results
  }

  const resolveTargetUser = async (target: string) => {
    const list = await findCandidateUsers(target)
    return list.length ? list[0] : null
  }

  const flattenOrgTree = (nodes: Array<{ id: number; name: string; children?: any[] }>, trail = '') => {
    const out: Array<{ id: number; name: string; path: string }> = []
    nodes.forEach(n => {
      const name = String(n.name || '')
      const path = trail ? `${trail} / ${name}` : name
      out.push({ id: Number(n.id), name, path })
      if (Array.isArray(n.children) && n.children.length) {
        out.push(...flattenOrgTree(n.children as any, path))
      }
    })
    return out
  }

  const findOrgCandidates = async (keyword: string) => {
    const cleaned = String(keyword || '').trim()
    if (!cleaned) return []
    try {
      const tree = await orgsApi.tree()
      const list = flattenOrgTree(tree)
      const lower = cleaned.toLowerCase()
      const hits = list.filter(o => o.name.toLowerCase().includes(lower) || o.path.toLowerCase().includes(lower))
      return hits
    } catch {
      return []
    }
  }

  const roleAlias = (value: string) => {
    const v = String(value || '').trim().toLowerCase()
    if (!v) return null
    if (['teacher', '老师', '教师'].includes(v)) return 'teacher'
    if (['student', '学生'].includes(v)) return 'student'
    if (['admin', '管理员', '超级管理员', '系统管理员'].includes(v)) return 'admin'
    return null
  }

  const fetchRoles = async (keyword?: string) => {
    const res = await rolesApi.list({ page: 1, pageSize: 200, keyword: keyword || undefined })
    if (!isSuccess(res)) throw new Error(getErr(res, '获取角色列表失败'))
    const data: any = res.data
    const roles = Array.isArray(data) ? data : Array.isArray(data?.roles) ? data.roles : []
    return roles as Array<{ id: number; name: string; code: string }>
  }

  const findRoleCandidates = async (payload: any) => {
    const roleIdRaw = Number(payload.role_id ?? payload.roleId ?? 0)
    if (Number.isFinite(roleIdRaw) && roleIdRaw > 0) {
      try {
        const res = await rolesApi.get(roleIdRaw)
        if (isSuccess(res) && res.data) return [res.data as any]
      } catch {}
    }
    const roleText = String(payload.role || payload.role_name || payload.roleName || payload.role_code || '').trim()
    const mapped = roleAlias(roleText)
    const roles = await fetchRoles(mapped || roleText || undefined)
    const lower = roleText.toLowerCase()
    const filtered = roles.filter(r => {
      const code = String(r.code || '').toLowerCase()
      const name = String(r.name || '').toLowerCase()
      if (mapped) return code === mapped
      if (roleText) return code === lower || name.includes(lower)
      return false
    })
    return filtered.length ? filtered : roles
  }

  const pollQuestionJob = async (jobId: string, payload: any) => {
    const startAt = Date.now()
    const total = Number(payload?.count ?? 0)
    const persist = !!payload?.persist
    const poll = async () => {
      try {
        const res: any = await aiApi.getQuestionJob(jobId)
        if (!res?.success) throw new Error(res?.error || '查询任务失败')
        const data = res?.data ?? {}
        const state = data?.state
        if (state === 'completed') {
          const result = data?.result || {}
          const generatedCount = Number(result?.generatedCount ?? 0)
          const createdCount = Number(result?.createdCount ?? 0)
          const errors = Array.isArray(result?.errors) ? result.errors : []
          const msg = persist
            ? `已创建 ${createdCount} / ${total} 道题目。`
            : `已生成 ${generatedCount} / ${total} 道题目。`
          append({ id: String(Date.now() + 9), role: 'assistant', content: msg })
          if (errors.length) {
            const detail = errors
              .slice(0, 3)
              .map((e: { error?: string }) => String(e?.error || '创建失败'))
              .join('；')
            append({
              id: String(Date.now() + 10),
              role: 'assistant',
              content: `部分题目创建失败：${detail}${errors.length > 3 ? ` 等共 ${errors.length} 条` : ''}`,
            })
          }
          return
        }
        if (state === 'failed') {
          append({
            id: String(Date.now() + 9),
            role: 'assistant',
            content: `后台任务失败：${data?.failedReason || '未知原因'}`,
          })
          return
        }
        if (Date.now() - startAt > 15 * 60 * 1000) {
          append({ id: String(Date.now() + 9), role: 'assistant', content: '任务仍在处理中，可稍后再试。' })
          return
        }
        setTimeout(poll, 2000)
      } catch (e: any) {
        message.error(e?.message || '查询任务失败')
      }
    }
    setTimeout(poll, 1200)
  }

  const pollSystemTestJob = async (jobId: string) => {
    const startAt = Date.now()
    const poll = async () => {
      try {
        const res: any = await systemTestsApi.job(jobId)
        if (!res?.success) throw new Error(res?.error || '查询任务失败')
        const data = res?.data ?? {}
        const state = data?.state
        if (state === 'completed') {
          const result = data?.result || {}
          const summary = result?.summary
          if (summary) {
            append({
              id: String(Date.now() + 12),
              role: 'assistant',
              content: `测速完成：通过 ${summary.passed}/${summary.total}，失败 ${summary.failed}，耗时 ${summary.durationMs}ms。`,
            })
          } else {
            append({ id: String(Date.now() + 12), role: 'assistant', content: '测速完成。' })
          }
          const failures = Array.isArray(result?.results)
            ? result.results.filter((r: any) => r && r.ok === false)
            : []
          if (failures.length) {
            const detail = failures
              .slice(0, 3)
              .map((r: any) => `${r.name}: ${r.detail || '失败'}`)
              .join('；')
            append({
              id: String(Date.now() + 13),
              role: 'assistant',
              content: `失败项：${detail}${failures.length > 3 ? ` 等共 ${failures.length} 项` : ''}`,
            })
          }
          if (result?.report) {
            append({
              id: String(Date.now() + 14),
              role: 'assistant',
              content: `测速报告:\n${String(result.report)}`,
            })
          }
          return
        }
        if (state === 'failed') {
          append({
            id: String(Date.now() + 12),
            role: 'assistant',
            content: `测速任务失败：${data?.failedReason || '未知原因'}`,
          })
          return
        }
        if (Date.now() - startAt > 20 * 60 * 1000) {
          append({ id: String(Date.now() + 12), role: 'assistant', content: '任务仍在处理中，可稍后再试。' })
          return
        }
        setTimeout(poll, 2000)
      } catch (e: any) {
        message.error(e?.message || '查询任务失败')
      }
    }
    setTimeout(poll, 1200)
  }

  const appendTextToInput = (text: string) => {
    const clean = String(text || '').trim()
    if (!clean) return
    setInput(prev => {
      const base = prev.trimEnd()
      return base ? `${base} ${clean}` : clean
    })
  }

  const extractAttachmentText = async (file: File) => {
    if (file.size > MAX_ATTACHMENT_SIZE) {
      throw new Error('文件超过 10MB，暂不处理')
    }
    if (file.type.startsWith('image/')) {
      const tesseract = await import('tesseract.js')
      const result = await (tesseract as any).recognize(file, 'chi_sim+eng')
      return truncateAttachmentText(String(result?.data?.text || ''))
    }
    if (isTextFile(file)) {
      return truncateAttachmentText(await file.text())
    }
    throw new Error('暂只支持图片 OCR 和文本类文件')
  }

  const processAttachment = async (file: File) => {
    const id = `${Date.now()}-${file.name}-${Math.random().toString(16).slice(2)}`
    const base: AssistantAttachment = {
      id,
      name: file.name || '未命名文件',
      mime: file.type || 'application/octet-stream',
      status: 'processing',
    }
    setAttachments(prev => [...prev, base])
    try {
      const text = await extractAttachmentText(file)
      if (!text.trim()) throw new Error(file.type.startsWith('image/') ? 'OCR 未识别到文字' : '文件没有可读取文本')
      setAttachments(prev => prev.map(item => (item.id === id ? { ...item, status: 'ready', text } : item)))
      message.success(file.type.startsWith('image/') ? `已识别图片：${file.name}` : `已读取文件：${file.name}`)
    } catch (e: any) {
      setAttachments(prev =>
        prev.map(item => (item.id === id ? { ...item, status: 'error', error: e?.message || '处理失败' } : item))
      )
      message.error(`${file.name}：${e?.message || '处理失败'}`)
    }
  }

  const handleAttachmentFiles = (files: FileList | File[] | null) => {
    const list = Array.from(files || [])
    if (!list.length) return
    list.slice(0, 5).forEach(file => {
      void processAttachment(file)
    })
    if (list.length > 5) message.warning('一次最多处理 5 个附件')
  }

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(item => item.id !== id))
  }

  const buildAttachmentContext = (files: AssistantAttachment[]) => {
    if (!files.length) return ''
    return [
      '以下是用户上传附件中提取出的文字内容。请把它当作用户提供的上下文；如果 OCR 可能有误，请在回答中提示需要核对。',
      ...files.map(file => `\n[附件：${file.name}]\n${file.text || ''}`),
    ].join('\n')
  }

  const toggleVoiceInput = () => {
    if (listening) {
      speechRef.current?.stop?.()
      setListening(false)
      return
    }
    const SpeechRecognition = getSpeechRecognitionCtor()
    if (!SpeechRecognition) {
      message.warning('当前浏览器不支持语音输入，请使用 Chrome 或 Edge。')
      return
    }
    const recognition = new SpeechRecognition() as BrowserSpeechRecognition
    speechRef.current = recognition
    recognition.lang = 'zh-CN'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.onresult = (event: any) => {
      let finalText = ''
      for (let i = event.resultIndex || 0; i < event.results.length; i += 1) {
        const text = event.results[i]?.[0]?.transcript || ''
        if (event.results[i]?.isFinal) finalText += text
      }
      appendTextToInput(finalText)
    }
    recognition.onerror = (event: any) => {
      setListening(false)
      message.error(event?.error === 'not-allowed' ? '浏览器未授权麦克风' : '语音识别失败')
    }
    recognition.onend = () => setListening(false)
    try {
      recognition.start()
      setListening(true)
    } catch (e: any) {
      setListening(false)
      message.error(e?.message || '启动语音输入失败')
    }
  }

  const scheduleActionByMode = (action?: AgentAction) => {
    if (!action || executionMode === 'request') return
    const run = () => {
      void executeAction(action, {
        automated: true,
        confirmation: executionMode === 'auto' ? 'skip' : 'ask',
      })
    }
    window.setTimeout(run, 0)
  }

  const send = async () => {
    const text = input.trim() || (readyAttachments.length ? '请分析我上传的附件内容。' : '')
    if (!text || loading) return
    if (attachmentBusy) {
      message.warning('附件仍在识别中，请稍后再发送。')
      return
    }
    const filesForThisTurn = readyAttachments
    const attachmentContext = buildAttachmentContext(filesForThisTurn)
    const modelText = attachmentContext ? `${text}\n\n${attachmentContext}` : text
    const displayText = filesForThisTurn.length
      ? `${text}\n\n已附加：${filesForThisTurn.map(file => file.name).join('、')}`
      : text
    setInput('')
    setAttachments(prev => prev.filter(item => item.status === 'error'))
    append({ id: String(Date.now()), role: 'user', content: displayText })
    setLoading(true)
    try {
      const modelToUse = customModel.trim() || model || undefined
      const res: any = await aiApi.agent({
        messages: [...trimmedItems, { role: 'user', content: modelText }],
        model: modelToUse,
        sessionId: activeSession?.id,
      })
      if (!res?.success) throw new Error(res?.error || 'AI 请求失败')
      const root = res?.data ?? {}
      const payload = root?.data ?? root
      const reply = String(payload?.reply || '')
      const action = payload?.action && typeof payload.action === 'object' ? payload.action : undefined
      append({
        id: String(Date.now() + 1),
        role: 'assistant',
        content: reply || '（已处理）',
        action,
      })
      scheduleActionByMode(action)
    } catch (e: any) {
      if (isAuthExpired(e)) {
        append({ id: String(Date.now() + 2), role: 'assistant', content: '登录已过期，请重新登录后再试。' })
        promptReLogin()
        return
      }
      message.error(e?.message || 'AI 请求失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async (content: string) => {
    const text = String(content || '')
    if (!text) return
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        document.execCommand('copy')
        textarea.remove()
      }
      message.success('已复制')
    } catch (e: any) {
      message.error(e?.message || '复制失败')
    }
  }

  const handleEdit = (content: string) => {
    setInput(String(content || ''))
    setTimeout(() => inputRef.current?.focus?.(), 0)
  }

  const fillQuickCommand = (prompt: string) => {
    setInput(prompt)
    setTimeout(() => inputRef.current?.focus?.(), 0)
  }

  const executeAction = async (action: AgentAction, options: ExecuteOptions = {}) => {
    const run = async () => {
      const actionKey = `${action.type}:${actionSummary(action)}`
      setExecutingActionKey(actionKey)
      try {
        switch (action.type) {
          case 'navigate':
            if (action.payload?.path) {
              const raw = String(action.payload.path)
              let next = raw
              if (/^\/exam-paper-generator\b/.test(raw) || /^\/paper-generator\b/.test(raw)) {
                next = '/admin/papers/create/smart'
              } else if (/^\/paper-detail\//.test(raw)) {
                next = raw.replace(/^\/paper-detail\//, '/admin/paper-detail/')
              } else if (raw === '/papers/create/smart') {
                next = '/admin/papers/create/smart'
              }
              navigate(next)
            }
            append({ id: String(Date.now() + 2), role: 'assistant', content: '已完成页面跳转。' })
            return
          case 'open_url':
            if (action.payload?.url) window.open(String(action.payload.url), '_blank')
            append({ id: String(Date.now() + 3), role: 'assistant', content: '已打开链接。' })
            return
          case 'generate_questions': {
            const rawPayload = action.payload || {}
            const total = Number(rawPayload.count ?? 5)
            if (!Number.isFinite(total) || total <= 0) throw new Error('题目数量无效')
            const persist = !!rawPayload.persist
            const useAsync = String(rawPayload.background ?? '').toLowerCase() !== 'false'
            if (useAsync) {
              const res: any = await aiApi.generateQuestionsAsync({ ...rawPayload, count: total })
              if (!res?.success) throw new Error(res?.error || '后台任务创建失败')
              const jobId = String(res?.data?.jobId || res?.data?.id || '')
              if (!jobId) throw new Error('未返回任务ID')
              append({
                id: String(Date.now() + 4),
                role: 'assistant',
                content: `已提交后台任务（任务ID ${jobId}），正在生成中。`,
              })
              void pollQuestionJob(jobId, { ...rawPayload, count: total, persist })
              return
            }

            const batchSize = Math.max(
              5,
              Math.min(QUESTION_BATCH_MAX, Number(rawPayload.batch_size ?? QUESTION_BATCH_SIZE))
            )
            const batches = Math.ceil(total / batchSize)
            let generatedTotal = 0
            let createdTotal = 0
            const errors: Array<{ error?: string; item?: any }> = []

            for (let i = 0; i < batches; i++) {
              const count = i === batches - 1 ? total - batchSize * i : batchSize
              const res: any = await aiApi.generateQuestions({ ...rawPayload, count })
              if (!res?.success) throw new Error(res?.error || '生成题目失败')
              const data = res?.data ?? {}
              const qs = data?.data?.questions ?? []
              const created = data?.created ?? []
              const errs = data?.errors ?? []
              generatedTotal += Array.isArray(qs) ? qs.length : 0
              createdTotal += Array.isArray(created) ? created.length : 0
              if (Array.isArray(errs) && errs.length) errors.push(...errs)
            }

            const msg = persist
              ? `已创建 ${createdTotal} / ${total} 道题目。`
              : `已生成 ${generatedTotal} / ${total} 道题目。`
            append({ id: String(Date.now() + 4), role: 'assistant', content: msg })
            if (errors.length) {
              const detail = errors
                .slice(0, 3)
                .map((e: { error?: string }) => String(e?.error || '创建失败'))
                .join('；')
              append({
                id: String(Date.now() + 5),
                role: 'assistant',
                content: `部分题目创建失败：${detail}${errors.length > 3 ? ` 等共 ${errors.length} 条` : ''}`,
              })
            }
            if (persist && createdTotal < total) {
              const remaining = Math.max(0, total - createdTotal)
              append({
                id: String(Date.now() + 6),
                role: 'assistant',
                content: `还有 ${remaining} 道题目未创建，需要重试吗？`,
                action: { type: 'generate_questions', payload: { ...rawPayload, count: remaining, persist: true } },
              })
            }
            return
          }
          case 'suggest_paper': {
            const res: any = await aiApi.suggestPaper(action.payload || {})
            if (!res?.success) throw new Error(res?.error || '组卷建议失败')
            const data = res?.data?.data ?? res?.data ?? {}
            const msg = `组卷建议：总题数 ${data.totalQuestions ?? '-'}，总分 ${data.totalScore ?? '-'}，时长 ${
              data.duration ?? '-'
            } 分钟。`
            append({ id: String(Date.now() + 5), role: 'assistant', content: msg })
            return
          }
          case 'create_paper': {
            const payload = action.payload || {}
            const totalQuestions = Number(payload.totalQuestions ?? payload.total_questions ?? payload.count ?? 10)
            const totalScore = Number(payload.totalScore ?? payload.total_score ?? 100)
            const duration = Number(payload.duration ?? 60)
            const difficultyRaw = String(payload.difficulty || '').toLowerCase()
            const difficulty =
              difficultyRaw === 'easy' || difficultyRaw === 'medium' || difficultyRaw === 'hard'
                ? difficultyRaw
                : undefined
            const title = String(payload.title || payload.target || '智能组卷').trim()
            const reqPayload: any = {
              title,
              description: String(payload.description || ''),
              duration,
              target_count: Number.isFinite(totalQuestions) ? totalQuestions : 10,
              total_score: Number.isFinite(totalScore) ? totalScore : 100,
            }
            if (difficulty) reqPayload.difficulty = difficulty
            if (reqPayload.target_count && reqPayload.total_score) {
              reqPayload.per_question_score = Math.max(1, Math.floor(reqPayload.total_score / reqPayload.target_count))
            }
            const res = await api.post('/papers/smart-generate', reqPayload)
            if (!isSuccess(res)) throw new Error(getErr(res, '生成试卷失败'))
            const d: any = (res as any)?.data?.data ?? (res as any)?.data ?? res
            const paperId = Number(d?.paperId ?? d?.paper_id ?? 0)
            if (paperId) {
              append({
                id: String(Date.now() + 6),
                role: 'assistant',
                content: `试卷已生成：${d?.title || title}（${d?.count ?? reqPayload.target_count} 题）。`,
              })
              const enableReview = payload.enable_review === true || payload.enableReview === true
              if (enableReview) {
                const starterName = String(payload.starter_name || payload.starterName || '').trim()
                const currentName = String(user?.nickname || user?.email || '').trim()
                if (starterName && currentName && starterName !== currentName) {
                  append({
                    id: String(Date.now() + 7),
                    role: 'assistant',
                    content: `当前登录账号为 ${currentName}，流程发起人需要是 ${starterName}。请切换账号后再发起审核。`,
                  })
                  navigate(`/admin/paper-detail/${paperId}`)
                  return
                }
                const templateId = Number(payload.template_id ?? payload.templateId ?? payload.workflow_template_id ?? 0)
                let resolvedTemplateId = templateId
                if (!resolvedTemplateId) {
                  const list = await workflowsApi.listTemplates({ entity_type: 'paper', status: 'published' })
                  const tpl = list.items?.[0]
                  resolvedTemplateId = Number(tpl?.id ?? 0)
                }
                if (!resolvedTemplateId) {
                  append({
                    id: String(Date.now() + 8),
                    role: 'assistant',
                    content: '没有找到可用的试卷审批流程模板，请先在流程管理中发布模板。',
                  })
                  navigate(`/admin/paper-detail/${paperId}`)
                  return
                }
                try {
                  const reviewerIds = Array.isArray(payload.reviewer_ids) ? payload.reviewer_ids : []
                  const requiredApprovals = payload.required_approvals
                  const reviewRes: any = await papersApi.submitReview(paperId, {
                    template_id: resolvedTemplateId,
                    reviewer_ids: reviewerIds,
                    required_approvals: Number.isFinite(Number(requiredApprovals)) ? Number(requiredApprovals) : undefined,
                  })
                  if (!reviewRes?.success) throw new Error(reviewRes?.error || '发起审核失败')
                  append({
                    id: String(Date.now() + 8),
                    role: 'assistant',
                    content: '已发起试卷审批流程。',
                  })
                } catch (err: any) {
                  append({
                    id: String(Date.now() + 8),
                    role: 'assistant',
                    content: err?.message || '发起审批失败',
                  })
                }
              }
              navigate(`/admin/paper-detail/${paperId}`)
              return
            }
            append({
              id: String(Date.now() + 6),
              role: 'assistant',
              content: '已生成试卷预览，请在智能组卷页面继续。',
            })
            navigate('/admin/papers/create/smart')
            return
          }
          case 'update_paper': {
            const payload = action.payload || {}
            const wantsLatest =
              payload.use_latest_paper === true ||
              payload.use_latest === true ||
              payload.latest === true ||
              String(payload.paper_id ?? payload.paperId ?? '').toLowerCase() === 'latest'
            const paperId = Number(payload.paper_id ?? payload.paperId ?? 0)
            let resolved: { id: number; title?: string } | null = null
            if (paperId) {
              try {
                const paper = await papersApi.getById(paperId)
                const pid = Number((paper as any)?.id ?? 0)
                if (pid) resolved = { id: pid, title: String((paper as any)?.title || '') }
              } catch {}
            }
            if (!resolved && wantsLatest) {
              const list = await papersApi.list({ page: 1, limit: 1 })
              const item = list.items?.[0]
              const pid = Number(item?.id ?? 0)
              if (pid) resolved = { id: pid, title: String(item?.title || '') }
            }
            if (!resolved) {
              const searchText = String(
                payload.current_title ||
                  payload.paper_title ||
                  payload.old_title ||
                  payload.source_title ||
                  payload.search ||
                  ''
              ).trim()
              if (searchText) {
                const list = await papersApi.list({ page: 1, limit: 10, search: searchText })
                const exact = list.items?.find(i => String(i.title || '').toLowerCase() === searchText.toLowerCase())
                const item = exact || list.items?.[0]
                const pid = Number(item?.id ?? 0)
                if (pid) resolved = { id: pid, title: String(item?.title || '') }
              }
            }
            if (!resolved) {
              append({
                id: String(Date.now() + 11),
                role: 'assistant',
                content: '需要明确要修改的试卷ID，请提供试卷ID或说明“最新试卷”。',
              })
              return
            }
            const patch: any = {}
            if (payload.title) patch.title = String(payload.title)
            if (payload.description) patch.description = String(payload.description)
            if (payload.difficulty) patch.difficulty = String(payload.difficulty)
            if (payload.total_score ?? payload.totalScore) {
              const v = Number(payload.total_score ?? payload.totalScore)
              if (Number.isFinite(v)) patch.total_score = v
            }
            if (payload.duration != null) {
              const v = Number(payload.duration)
              if (Number.isFinite(v)) patch.duration = v
            }
            if (!Object.keys(patch).length) {
              append({
                id: String(Date.now() + 11),
                role: 'assistant',
                content: '没有可修改的字段，请说明要修改的内容（如标题、时长）。',
              })
              return
            }
            const res: any = await papersApi.update(resolved.id, patch)
            if (!res?.success) throw new Error(res?.error || '修改试卷失败')
            append({
              id: String(Date.now() + 12),
              role: 'assistant',
              content: `试卷已更新：${patch.title || resolved.title || `ID ${resolved.id}`}`,
            })
            navigate(`/admin/paper-detail/${resolved.id}`)
            return
          }
          case 'create_task': {
            const payload = action.payload || {}
            const title = String(payload.title || '新任务').trim()
            const description = String(payload.description || '')
            const type = payload.type === 'exam' ? 'exam' : 'practice'
            const paperId = Number(payload.paper_id ?? payload.paperId ?? 0)
            const examId = Number(payload.exam_id ?? payload.examId ?? 0)
            const assignAll = payload.assign_all === true || payload.assignAll === true
            const publish = payload.publish !== false
            const wantsLatestPaper =
              payload.use_latest_paper === true ||
              payload.use_latest === true ||
              payload.latest === true ||
              String(payload.paper_id ?? payload.paperId ?? '').toLowerCase() === 'latest'

            const fetchLatestPaper = async (): Promise<{ id: number; title?: string } | null> => {
              const list = await papersApi.list({ page: 1, limit: 1 })
              const item = list.items?.[0]
              const id = Number(item?.id ?? 0)
              if (!Number.isFinite(id) || id <= 0) return null
              return { id, title: String(item?.title || '') }
            }

            const validatePaper = async (id: number): Promise<{ id: number; title?: string } | null> => {
              if (!Number.isFinite(id) || id <= 0) return null
              const res = await api.get(`/papers/${id}`)
              if (!isSuccess(res)) return null
              const paper = (res as any)?.data?.paper ?? (res as any)?.data ?? null
              const pid = Number(paper?.id ?? 0)
              if (!Number.isFinite(pid) || pid <= 0) return null
              return { id: pid, title: String(paper?.title || '') }
            }

            let resolvedPaper: { id: number; title?: string } | null = null
            if (type === 'exam' && !examId) {
              if (paperId) {
                resolvedPaper = await validatePaper(paperId)
                if (!resolvedPaper && !wantsLatestPaper) {
                  append({
                    id: String(Date.now() + 9),
                    role: 'assistant',
                    content: `未找到试卷ID ${paperId}，请提供有效试卷ID或先生成试卷。`,
                  })
                  return
                }
              }
              if (!resolvedPaper) {
                const latest = await fetchLatestPaper()
                if (!latest) {
                  append({
                    id: String(Date.now() + 9),
                    role: 'assistant',
                    content: '当前没有可用试卷，请先生成试卷后再创建考试任务。',
                  })
                  return
                }
                if (paperId && paperId !== latest.id) {
                  append({
                    id: String(Date.now() + 9),
                    role: 'assistant',
                    content: `已自动选择最新试卷（ID ${latest.id}${latest.title ? `：${latest.title}` : ''}）。`,
                  })
                }
                resolvedPaper = latest
              }
            }
            const toDate = (v: any) => {
              if (!v) return null
              const d = new Date(v)
              return Number.isNaN(d.getTime()) ? null : d
            }
            const now = new Date()
            let startDate = toDate(payload.start_time || payload.startTime) || now
            let endDate =
              toDate(payload.end_time || payload.endTime) || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            let adjusted = false
            if (endDate.getTime() <= now.getTime()) {
              endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
              adjusted = true
            }
            if (startDate.getTime() > endDate.getTime()) {
              startDate = now
              adjusted = true
            }
            if (adjusted) {
              append({
                id: String(Date.now() + 9),
                role: 'assistant',
                content: '已自动调整任务时间（结束时间需晚于当前时间）。',
              })
            }
            const start = startDate.toISOString()
            const end = endDate.toISOString()
            const res: any = await tasksApi.create({
              title,
              description,
              type,
              start_time: start,
              end_time: end,
              paper_id: resolvedPaper?.id || paperId || undefined,
              exam_id: examId || undefined,
              assign_all: assignAll,
              assigned_user_ids: [],
              assigned_department_ids: [],
            })
            if (!res?.success) throw new Error(res?.error || '创建任务失败')
            const task = res?.data?.task ?? res?.data ?? {}
            const taskId = Number(task?.id || 0)
            if (publish && taskId) {
              const pub: any = await tasksApi.publish(taskId)
              if (!pub?.success) throw new Error(pub?.error || '发布任务失败')
            }
            append({
              id: String(Date.now() + 10),
              role: 'assistant',
              content: publish ? `任务已创建并下发：${title}` : `任务已创建：${title}`,
            })
            if (taskId) navigate(`/admin/tasks/detail/${taskId}`)
            return
          }
          case 'create_user': {
            if (user?.role !== 'admin') {
              append({ id: String(Date.now() + 10), role: 'assistant', content: '只有管理员可以创建用户。' })
              return
            }
            const payload = action.payload || {}
            const confirm = payload.confirm === true
            const email = String(payload.email || '').trim()
            const username = String(payload.username || '').trim()
            const phone = String(payload.phone || '').trim()
            const nicknameRaw = String(payload.nickname || payload.name || '').trim()
            const role =
              payload.role === 'admin' || payload.role === 'teacher' || payload.role === 'student'
                ? payload.role
                : 'student'
            const status = payload.status === 'disabled' ? 'disabled' : 'active'
            const orgIdRaw = Number(payload.org_id ?? payload.orgId ?? 0)
            const orgName = String(payload.org_name || payload.orgName || payload.department || payload.org || '').trim()
            const useRandom =
              payload.generate_password === true || payload.random_password === true || payload.auto_password === true
            const userProvidedPassword = !!payload.password
            let password = String(payload.password || '').trim()

            if (!email && !username && !phone) {
              append({
                id: String(Date.now() + 10),
                role: 'assistant',
                content: '创建用户需要至少提供邮箱、用户名或手机号中的一个。',
              })
              return
            }

            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !confirm) {
              append({
                id: String(Date.now() + 10),
                role: 'assistant',
                content: `邮箱格式看起来不完整（${email}）。是否仍要创建该用户？`,
                action: { type: 'create_user', payload: { ...payload, confirm: true } },
              })
              return
            }

            let resolvedOrgId = orgIdRaw || undefined
            let resolvedOrgLabel = ''
            if (!resolvedOrgId && orgName) {
              const candidates = await findOrgCandidates(orgName)
              if (!candidates.length) {
                append({
                  id: String(Date.now() + 10),
                  role: 'assistant',
                  content: `未找到“${orgName}”对应的部门，请提供准确名称或部门ID。`,
                })
                return
              }
              if (candidates.length > 1) {
                const lines = candidates
                  .slice(0, 3)
                  .map((o, idx) => `${idx + 1}) ${o.path} (ID ${o.id})`)
                  .join('\n')
                append({
                  id: String(Date.now() + 10),
                  role: 'assistant',
                  content: `匹配到多个部门，请确认要放在哪个部门：\n${lines}\n请回复部门ID或更精确名称。`,
                })
                return
              }
              resolvedOrgId = candidates[0].id
              resolvedOrgLabel = candidates[0].path
            }

            if (!password) {
              password = generatePassword(12)
            }
            if (password.length < 8) throw new Error('新密码至少 8 位')
            if (passwordKinds(password) < 2) throw new Error('密码至少包含两类（大小写/数字/符号）')

            const nickname = nicknameRaw || (email ? email.split('@')[0] : username || phone || '新用户')

            const created = await usersApi.create({
              nickname,
              password,
              email: email || undefined,
              username: username || undefined,
              phone: phone || undefined,
              role,
              status,
              org_id: resolvedOrgId,
            } as any)

            const pwdNote = userProvidedPassword
              ? '密码已按你提供的设置。'
              : `默认密码：${password}（请妥善保存）`
            append({
              id: String(Date.now() + 11),
              role: 'assistant',
              content:
                `已创建用户：${created.email || created.nickname || created.username || created.id}` +
                (resolvedOrgLabel ? `，部门：${resolvedOrgLabel}` : '') +
                `，角色：${role}。` +
                pwdNote,
            })
            return
          }
          case 'create_org': {
            if (user?.role !== 'admin') {
              append({ id: String(Date.now() + 10), role: 'assistant', content: '只有管理员可以创建部门。' })
              return
            }
            const payload = action.payload || {}
            const confirm = payload.confirm === true
            const name = String(payload.name || payload.org_name || payload.orgName || payload.department || payload.dept || '')
              .trim()
            const parentIdRaw = Number(payload.parent_id ?? payload.parentId ?? 0)
            const parentName = String(payload.parent_name || payload.parentName || payload.parent || '').trim()
            if (!name) {
              append({ id: String(Date.now() + 10), role: 'assistant', content: '请提供部门名称。' })
              return
            }

            let parentId = Number.isFinite(parentIdRaw) && parentIdRaw > 0 ? parentIdRaw : undefined
            let parentLabel = ''
            if (!parentId && parentName) {
              const candidates = await findOrgCandidates(parentName)
              if (!candidates.length) {
                append({
                  id: String(Date.now() + 10),
                  role: 'assistant',
                  content: `未找到上级部门“${parentName}”，请提供准确名称或部门ID。`,
                })
                return
              }
              if (candidates.length > 1 && !confirm) {
                const lines = candidates
                  .slice(0, 3)
                  .map((o, idx) => `${idx + 1}) ${o.path} (ID ${o.id})`)
                  .join('\n')
                append({
                  id: String(Date.now() + 10),
                  role: 'assistant',
                  content: `匹配到多个上级部门，请确认挂在哪个：\n${lines}\n请回复部门ID或更精确名称。`,
                })
                return
              }
              parentId = candidates[0].id
              parentLabel = candidates[0].path
            }

            const created = await orgsApi.create({
              name,
              parent_id: parentId,
            })
            const orgId = Number((created as any)?.id ?? 0)
            const orgLabel = parentLabel ? `${parentLabel} / ${name}` : name

            const users = Array.isArray(payload.users) ? payload.users : []
            const results: Array<{ label: string; ok: boolean; error?: string }> = []
            for (const u of users) {
              const email = String(u?.email || '').trim()
              const username = String(u?.username || '').trim()
              const phone = String(u?.phone || '').trim()
              if (!email && !username && !phone) {
                results.push({ label: String(u?.nickname || u?.name || '未知用户'), ok: false, error: '缺少账号' })
                continue
              }
              const role =
                u?.role === 'admin' || u?.role === 'teacher' || u?.role === 'student' ? u.role : 'student'
              let password = String(u?.password || '').trim()
              if (!password) password = generatePassword(12)
              if (password.length < 8 || passwordKinds(password) < 2) {
                results.push({ label: email || username || phone, ok: false, error: '密码强度不足' })
                continue
              }
              const nickname = String(u?.nickname || u?.name || (email ? email.split('@')[0] : username || phone || '新用户'))
              try {
                await usersApi.create({
                  nickname,
                  password,
                  email: email || undefined,
                  username: username || undefined,
                  phone: phone || undefined,
                  role,
                  status: u?.status === 'disabled' ? 'disabled' : 'active',
                  org_id: orgId || parentId,
                } as any)
                results.push({ label: email || username || phone || nickname, ok: true })
              } catch (e: any) {
                results.push({ label: email || username || phone || nickname, ok: false, error: e?.message || '创建失败' })
              }
            }

            append({
              id: String(Date.now() + 11),
              role: 'assistant',
              content: `已创建部门：${orgLabel}${orgId ? `（ID ${orgId}）` : ''}。`,
            })

            if (users.length) {
              const okCount = results.filter(r => r.ok).length
              const fail = results.filter(r => !r.ok)
              append({
                id: String(Date.now() + 12),
                role: 'assistant',
                content: `用户创建完成：成功 ${okCount} / ${results.length}。` +
                  (fail.length
                    ? ` 失败：${fail
                        .slice(0, 3)
                        .map(f => `${f.label}（${f.error}）`)
                        .join('；')}${fail.length > 3 ? ` 等共 ${fail.length} 条` : ''}`
                    : ''),
              })
            }
            return
          }
          case 'assign_role': {
            if (user?.role !== 'admin') {
              append({ id: String(Date.now() + 10), role: 'assistant', content: '只有管理员可以分配角色。' })
              return
            }
            const payload = action.payload || {}
            const confirm = payload.confirm === true
            const target = String(
              payload.user_id ?? payload.email ?? payload.username ?? payload.target ?? payload.user ?? ''
            ).trim()
            const orgId = Number(payload.org_id ?? payload.orgId ?? 0) || undefined

            const candidates = await findCandidateUsers(target)
            if (!candidates.length) {
              append({
                id: String(Date.now() + 10),
                role: 'assistant',
                content: '未找到该用户，请提供完整邮箱或用户ID。',
              })
              return
            }
            if (candidates.length > 1 && !confirm) {
              const lines = candidates
                .slice(0, 3)
                .map((u, idx) => `${idx + 1}) ${u.label} (ID ${u.id})`)
                .join('\n')
              append({
                id: String(Date.now() + 10),
                role: 'assistant',
                content: `匹配到多个用户，请确认要给谁分配角色：\n${lines}\n请回复用户ID或完整邮箱。`,
              })
              return
            }
            const userPick = candidates[0]

            const roleCandidates = await findRoleCandidates(payload)
            if (!roleCandidates.length) {
              append({
                id: String(Date.now() + 10),
                role: 'assistant',
                content: '未找到该角色，请提供准确的角色名称或角色ID。',
              })
              return
            }
            if (roleCandidates.length > 1 && !confirm) {
              const lines = roleCandidates
                .slice(0, 3)
                .map((r, idx) => `${idx + 1}) ${r.name} (${r.code}) ID ${r.id}`)
                .join('\n')
              append({
                id: String(Date.now() + 10),
                role: 'assistant',
                content: `匹配到多个角色，请确认要分配哪一个：\n${lines}\n请回复角色ID或更精确的角色名称。`,
              })
              return
            }
            const rolePick = roleCandidates[0]

            if (!confirm) {
              append({
                id: String(Date.now() + 10),
                role: 'assistant',
                content: `确认给用户 ${userPick.label}（ID ${userPick.id}）分配角色 ${rolePick.name} 吗？`,
                action: {
                  type: 'assign_role',
                  payload: {
                    user_id: userPick.id,
                    role_id: rolePick.id,
                    org_id: orgId,
                    confirm: true,
                  },
                },
              })
              return
            }

            if (orgId) {
              const res = await rolesApi.getRolesForUserAssign(userPick.id, orgId)
              if (!isSuccess(res)) throw new Error(getErr(res, '获取用户角色失败'))
              const selected = Array.isArray((res.data as any)?.selected) ? (res.data as any).selected : []
              const next = Array.from(new Set([...selected.map(Number), Number(rolePick.id)].filter(Number.isFinite)))
              const setRes = await rolesApi.setUserRoles(userPick.id, next, orgId)
              if (!isSuccess(setRes)) throw new Error(getErr(setRes, '分配角色失败'))
            } else {
              const addRes = await rolesApi.addUsersToRole(Number(rolePick.id), [userPick.id])
              if (!isSuccess(addRes)) throw new Error(getErr(addRes, '分配角色失败'))
            }

            append({
              id: String(Date.now() + 11),
              role: 'assistant',
              content: `已为用户 ${userPick.label} 分配角色：${rolePick.name}。`,
            })
            return
          }
          case 'send_mail': {
            const to = String(action.payload?.to_email || action.payload?.email || action.payload?.recipient || '').trim()
            if (!to) throw new Error('缺少收件人邮箱')
            const subject = String(action.payload?.subject || '考试提醒')
            const content = String(action.payload?.content || '请及时参加考试。')
            const options = await mailApi.recipientOptions(to)
            const emailLower = to.toLowerCase()
            const hit =
              options.find(o => String(o.email || '').toLowerCase() === emailLower) ||
              options.find(o => String(o.name || '').includes(to))
            if (!hit) throw new Error('未找到该邮箱对应的用户')
            const sendExternal = await new Promise<boolean>(resolve => {
              Modal.confirm({
                title: '发送到外部邮箱？',
                content: `是否同时发送到外部邮箱（${hit.email || to}）？`,
                okText: '外部+站内',
                cancelText: '仅站内信',
                onOk: () => resolve(true),
                onCancel: () => resolve(false),
              })
            })
            await mailApi.send({ subject, content, recipients: [hit.id], send_external: sendExternal })
            append({
              id: String(Date.now() + 5),
              role: 'assistant',
              content: sendExternal ? `已发送站内信并外部邮件给 ${hit.email || to}` : `已发送站内信给 ${hit.email || to}`,
            })
            return
          }
          case 'study_plan': {
            const res: any = await aiApi.studyPlan(action.payload || {})
            if (!res?.success) throw new Error(res?.error || '学习计划生成失败')
            const data = res?.data?.data ?? res?.data ?? {}
            const weeks = Array.isArray(data.plan) ? data.plan.length : 0
            append({ id: String(Date.now() + 6), role: 'assistant', content: `已生成学习计划（${weeks} 周）。` })
            return
          }
          case 'explain_question': {
            const res: any = await aiApi.explainQuestion(action.payload || {})
            if (!res?.success) throw new Error(res?.error || '题目解析失败')
            const data = res?.data?.data ?? res?.data ?? {}
            const exp = data?.explanation || data?.raw || '解析生成成功。'
            append({ id: String(Date.now() + 7), role: 'assistant', content: String(exp) })
            return
          }
          case 'summarize_exam': {
            const payload = action.payload || {}
            const examResultId = payload.exam_result_id ?? payload.examResultId ?? payload.result_id
            const res: any = await aiApi.examSummary(
              examResultId ? { exam_result_id: examResultId } : payload
            )
            if (!res?.success) throw new Error(res?.error || '考试总结失败')
            const data = res?.data?.data ?? res?.data ?? {}
            const summary = data?.summary || data?.raw || '总结生成成功。'
            append({ id: String(Date.now() + 8), role: 'assistant', content: String(summary) })
            return
          }
          case 'run_test': {
            const modules = Array.isArray(action.payload?.modules) ? action.payload.modules : undefined
            const iterations = Number(action.payload?.iterations || 1)
            const res: any = await systemTestsApi.run({ modules, iterations })
            if (!res?.success) throw new Error(res?.error || '创建测速任务失败')
            const jobId = String(res?.data?.jobId || '')
            if (!jobId) throw new Error('未返回任务ID')
            append({
              id: String(Date.now() + 12),
              role: 'assistant',
              content: `已提交系统测速任务（任务ID ${jobId}），后台执行中。`,
            })
            void pollSystemTestJob(jobId)
            return
          }
          case 'change_password': {
            const payload = await promptChangePassword()
            if (!payload) return
            const res = await api.put<unknown>('/users/me/password', payload)
            if (!isSuccess(res)) throw new Error(getErr(res, '修改密码失败'))
            append({ id: String(Date.now() + 9), role: 'assistant', content: '密码已更新，请使用新密码登录。' })
            return
          }
          case 'reset_password': {
            if (user?.role !== 'admin') {
              append({ id: String(Date.now() + 10), role: 'assistant', content: '只有管理员可以重置其他用户密码。' })
              return
            }
            const payload = action.payload || {}
            const confirm = payload.confirm === true
            const initial = String(
              payload.user_id ?? payload.email ?? payload.username ?? payload.target ?? ''
            ).trim()
            const suppliedPassword = String(
              payload.password ?? payload.new_password ?? payload.newPassword ?? ''
            )
            const useRandom =
              payload.random_password === true || payload.generate_password === true || payload.auto_password === true

            let target = initial
            let password = suppliedPassword
            if (!target || (!password && !useRandom)) {
              const payload = await promptResetPassword(initial)
              if (!payload) return
              target = payload.target
              password = payload.password || ''
            }

            if (!target) {
              message.error('缺少目标用户')
              return
            }

            if (!confirm) {
              const candidates = await findCandidateUsers(target)
              if (!candidates.length) {
                append({
                  id: String(Date.now() + 10),
                  role: 'assistant',
                  content: '未找到该用户，请提供完整邮箱或用户ID。',
                })
                return
              }
              if (candidates.length > 1) {
                const lines = candidates
                  .slice(0, 3)
                  .map((u, idx) => `${idx + 1}) ${u.label} (ID ${u.id})`)
                  .join('\n')
                append({
                  id: String(Date.now() + 10),
                  role: 'assistant',
                  content: `匹配到多个用户，请确认要重置哪个：\n${lines}\n请回复用户ID或完整邮箱。`,
                })
                return
              }
              const pick = candidates[0]
              append({
                id: String(Date.now() + 10),
                role: 'assistant',
                content: `确认要重置用户 ${pick.label}（ID ${pick.id}）的密码吗？`,
                action: {
                  type: 'reset_password',
                  payload: {
                    user_id: pick.id,
                    confirm: true,
                    password: password || undefined,
                    generate_password: useRandom,
                  },
                },
              })
              return
            }

            if (!password && useRandom) {
              password = generatePassword(12)
            }

            if (password) {
              if (password.length < 8) throw new Error('新密码至少 8 位')
              if (passwordKinds(password) < 2) throw new Error('密码至少包含两类（大小写/数字/符号）')
            }

            const targetUser = await resolveTargetUser(target)
            if (!targetUser) throw new Error('未找到该用户')
            const res = await usersApi.resetPassword(targetUser.id, password || undefined)
            if (!isSuccess(res)) throw new Error(getErr(res, '重置密码失败'))
            const tempPwd = (res.data as any)?.password
            const msg = password
              ? useRandom
                ? `已为用户（${targetUser.label}）设置新密码：${password}（请妥善保存）`
                : `已为用户（${targetUser.label}）设置新密码。`
              : tempPwd
                ? `已重置用户（${targetUser.label}）密码，默认密码：${tempPwd}（请妥善保存）`
                : `已重置用户（${targetUser.label}）密码为系统默认值。`
            append({ id: String(Date.now() + 11), role: 'assistant', content: msg })
            return
          }
          default:
            message.warning('该操作暂不支持')
        }
      } catch (e: any) {
        if (isAuthExpired(e)) {
          append({ id: String(Date.now() + 9), role: 'assistant', content: '登录已过期，请重新登录后再执行。' })
          promptReLogin()
          return
        }
        message.error(e?.message || '操作失败')
      } finally {
        setExecutingActionKey(null)
      }
    }

    const shouldConfirm = options.confirmation === 'skip' ? false : needsConfirm(action)
    if (shouldConfirm) {
      Modal.confirm({
        title: options.automated ? '审核后执行操作' : '确认执行操作',
        content: actionSummary(action),
        okText: options.automated ? '审核通过并执行' : '执行',
        cancelText: '取消',
        onOk: run,
      })
    } else {
      await run()
    }
  }

  return (
    <>
      <FloatButton icon={<MessageOutlined />} onClick={() => setOpen(true)} tooltip={<div>AI 助手</div>} />
      <Drawer
        rootClassName="ai-assistant-drawer"
        title={
          <Space size={10}>
            <RobotOutlined />
            <span>AI 助手</span>
            <Badge color={loading ? 'orange' : 'green'} text={loading ? '思考中' : '就绪'} />
          </Space>
        }
        placement="right"
        width="min(760px, calc(100vw - 24px))"
        onClose={() => setOpen(false)}
        open={open}
        styles={{ body: { padding: 0, background: '#f7f8fa' } }}
        extra={
          <Space>
            <Tooltip title="新建对话">
              <Button
                icon={<PlusOutlined />}
                onClick={() => {
                  const next = createSession()
                  setSessions(prev => [next, ...prev])
                  setActiveId(next.id)
                  setLastTouchedId(next.id)
                }}
              />
            </Tooltip>
            <Tooltip title="删除当前">
              <Button
                icon={<DeleteOutlined />}
                onClick={() => {
                  if (!activeSession) return
                  const deletingId = activeSession.id
                  if (sessions.length <= 1) {
                    const next = createSession()
                    setSessions([next])
                    setActiveId('')
                    setLastTouchedId(next.id)
                  } else {
                    setSessions(prev => prev.filter(s => s.id !== activeSession.id))
                    setActiveId(sessions.find(s => s.id !== activeSession.id)?.id || '')
                  }
                  if (user?.id) {
                    aiApi.deleteSession(deletingId).catch(() => {})
                  }
                }}
              />
            </Tooltip>
            <Tooltip title="清空当前">
              <Button
                icon={<ClearOutlined />}
                onClick={() => {
                  if (!activeSession) return
                  setSessions(prev =>
                    prev.map(s =>
                      s.id === activeSession.id
                        ? { ...s, title: '新对话', items: [HELLO_ITEM], updatedAt: Date.now() }
                        : s
                    )
                  )
                  setLastTouchedId(activeSession.id)
                }}
              />
            </Tooltip>
          </Space>
        }
      >
        <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr auto', height: '100%' }}>
          <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb', background: '#ffffff' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.1fr) minmax(180px, 0.9fr)',
                gap: 12,
                alignItems: 'start',
              }}
            >
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <Space wrap size={8}>
                  <Tag icon={<HistoryOutlined />} color="default">
                    {sessions.length} 个会话
                  </Tag>
                  <Tag icon={<ToolOutlined />} color={actionCount ? 'blue' : 'default'}>
                    {actionCount} 个动作
                  </Tag>
                  <Tag icon={<CheckCircleOutlined />} color={lastAction ? 'green' : 'default'}>
                    {lastAction ? ACTION_LABELS[lastAction.type] || lastAction.type : '无待办动作'}
                  </Tag>
                  <Tooltip title={executionModeMeta.description}>
                    <Tag color={executionModeMeta.color}>执行：{executionModeMeta.shortLabel}</Tag>
                  </Tooltip>
                </Space>
                <Space wrap size={8}>
                  {QUICK_COMMANDS.map(item => (
                    <Button key={item.label} size="small" icon={<ThunderboltOutlined />} onClick={() => fillQuickCommand(item.prompt)}>
                      {item.label}
                    </Button>
                  ))}
                </Space>
              </Space>
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Select
                  size="middle"
                  style={{ width: '100%' }}
                  value={activeSession?.id}
                  onChange={val => setActiveId(val)}
                  options={sessionOptions}
                  placeholder="历史对话"
                  showSearch
                />
                <Select
                  size="middle"
                  style={{ width: '100%' }}
                  value={model}
                  onChange={val => setModel(val)}
                  options={MODEL_OPTIONS}
                  placeholder="选择模型"
                  showSearch
                  allowClear
                />
                <Select
                  size="middle"
                  style={{ width: '100%' }}
                  value={executionMode}
                  onChange={val => setExecutionMode(normalizeExecutionMode(val))}
                  options={EXECUTION_MODE_OPTIONS}
                  placeholder="执行等级"
                />
                <Input
                  size="middle"
                  value={customModel}
                  onChange={e => setCustomModel(e.target.value)}
                  placeholder="自定义模型"
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  当前：{currentModelLabel}
                </Text>
              </Space>
            </div>
          </div>

          <div ref={listRef} style={{ overflow: 'auto', padding: '16px 18px' }}>
            <List
              split={false}
              dataSource={items}
              locale={{ emptyText: '暂无消息' }}
              renderItem={item => {
                const isUser = item.role === 'user'
                const actionKey = item.action ? `${item.action.type}:${actionSummary(item.action)}` : ''
                return (
                  <List.Item style={{ justifyContent: isUser ? 'flex-end' : 'flex-start', padding: '7px 0' }}>
                    <div style={{ maxWidth: '92%', minWidth: item.action ? 'min(460px, 100%)' : undefined }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: isUser ? 'flex-end' : 'flex-start',
                          marginBottom: 4,
                        }}
                      >
                        <Tag color={isUser ? 'processing' : 'success'}>{isUser ? '你' : '助手'}</Tag>
                      </div>
                      <div
                        style={{
                          background: isUser ? '#e6f4ff' : '#ffffff',
                          border: isUser ? '1px solid #91caff' : '1px solid #e5e7eb',
                          boxShadow: isUser ? 'none' : '0 8px 24px rgba(15, 23, 42, 0.06)',
                          padding: '10px 12px',
                          borderRadius: 8,
                          whiteSpace: 'pre-wrap',
                          lineHeight: 1.65,
                        }}
                      >
                        <Text>{item.content}</Text>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: isUser ? 'flex-end' : 'flex-start',
                          marginTop: 4,
                        }}
                      >
                        <Space size={4}>
                          <Tooltip title="复制">
                            <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => handleCopy(item.content)} />
                          </Tooltip>
                          {isUser && (
                            <Tooltip title="编辑">
                              <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(item.content)} />
                            </Tooltip>
                          )}
                        </Space>
                      </div>
                      {item.action && (
                        <div
                          style={{
                            marginTop: 8,
                            padding: 10,
                            borderRadius: 8,
                            border: '1px solid #dbeafe',
                            background: '#f8fbff',
                          }}
                        >
                          <Space direction="vertical" size={8} style={{ width: '100%' }}>
                            <Space wrap>
                              <Tag color="blue">{ACTION_LABELS[item.action.type] || item.action.type}</Tag>
                              {executionMode !== 'request' && (
                                <Tooltip
                                  title={
                                    executionMode === 'auto'
                                      ? '完全执行模式会直接运行该动作'
                                      : needsConfirm(item.action)
                                        ? '审核执行模式会先弹出确认'
                                        : '审核执行模式会自动运行该动作'
                                  }
                                >
                                  <Tag color={executionMode === 'auto' ? 'green' : needsConfirm(item.action) ? 'orange' : 'green'}>
                                    {executionMode === 'auto' ? '自动执行' : needsConfirm(item.action) ? '待审核' : '自动执行'}
                                  </Tag>
                                </Tooltip>
                              )}
                              <Text type="secondary">{actionSummary(item.action)}</Text>
                            </Space>
                            <Button
                              size="small"
                              type="primary"
                              icon={<ToolOutlined />}
                              loading={executingActionKey === actionKey}
                              disabled={!!executingActionKey && executingActionKey !== actionKey}
                              onClick={() => executeAction(item.action!)}
                            >
                              {executionMode === 'request' ? '执行' : '手动执行'}
                            </Button>
                          </Space>
                        </div>
                      )}
                    </div>
                  </List.Item>
                )
              }}
            />
          </div>

          <div style={{ padding: 16, borderTop: '1px solid #e5e7eb', background: '#ffffff' }}>
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.txt,.md,.markdown,.csv,.json,.log,.xml,.html,.htm,.yaml,.yml"
                style={{ display: 'none' }}
                onChange={e => {
                  handleAttachmentFiles(e.target.files)
                  e.currentTarget.value = ''
                }}
              />
              <TextArea
                rows={4}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="输入任务或问题，也可以上传图片让助手先 OCR 识别"
                ref={inputRef}
                onPaste={e => {
                  const files = Array.from(e.clipboardData?.files || [])
                  if (files.length) {
                    e.preventDefault()
                    handleAttachmentFiles(files)
                  }
                }}
                onPressEnter={e => {
                  if (!e.shiftKey) {
                    e.preventDefault()
                    void send()
                  }
                }}
              />
              {attachments.length > 0 && (
                <Space wrap size={6}>
                  {attachments.map(file => (
                    <Tooltip key={file.id} title={file.error || (file.text ? `${file.text.length} 字` : '处理中')}>
                      <Tag
                        color={file.status === 'ready' ? 'green' : file.status === 'error' ? 'red' : 'processing'}
                        closable
                        onClose={() => removeAttachment(file.id)}
                      >
                        {file.status === 'processing' ? '识别中：' : file.status === 'error' ? '失败：' : '已识别：'}
                        {file.name}
                      </Tag>
                    </Tooltip>
                  ))}
                </Space>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {attachmentBusy
                    ? '附件识别中'
                    : listening
                      ? '语音输入中'
                      : hydrating
                        ? '加载历史中'
                        : activeSession?.title || '新对话'}
                </Text>
                <Space size={8}>
                  <Tooltip title="上传图片或文本文件">
                    <Button icon={<PaperClipOutlined />} onClick={() => fileInputRef.current?.click()} />
                  </Tooltip>
                  <Tooltip title={listening ? '停止语音输入' : '语音输入'}>
                    <Button
                      icon={<AudioOutlined />}
                      type={listening ? 'primary' : 'default'}
                      danger={listening}
                      onClick={toggleVoiceInput}
                    />
                  </Tooltip>
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    loading={loading}
                    disabled={attachmentBusy}
                    onClick={send}
                  >
                    发送
                  </Button>
                </Space>
              </div>
            </Space>
          </div>
        </div>
      </Drawer>
    </>
  )
}
