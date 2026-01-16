import { App, Button, Drawer, FloatButton, Input, List, Modal, Select, Space, Tag, Typography } from 'antd'
import { CopyOutlined, EditOutlined, MessageOutlined, SendOutlined } from '@ant-design/icons'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { aiApi } from '@/shared/api/endpoints/ai'
import { systemTestsApi } from '@/shared/api/endpoints/system-tests'
import { mailApi } from '@/shared/api/endpoints/mail'
import { papersApi } from '@/shared/api/endpoints/papers'
import { orgsApi } from '@/shared/api/endpoints/orgs'
import { rolesApi } from '@/shared/api/endpoints/roles'
import { tasksApi } from '@/shared/api/endpoints/tasks'
import { usersApi } from '@/shared/api/endpoints/users'
import { api, getErr, isSuccess } from '@/shared/api/http'
import { useAuth } from '@/shared/contexts/AuthContext'

const { Text } = Typography
const { TextArea } = Input

type ChatRole = 'user' | 'assistant' | 'system'
type AgentAction = { type: string; payload?: any }
type ChatItem = { id: string; role: ChatRole; content: string; action?: AgentAction }
type ChatSession = { id: string; title: string; items: ChatItem[]; createdAt: number; updatedAt: number }

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
  suggest_paper: '组卷建议',
  study_plan: '学习计划',
  explain_question: '题目解析',
  summarize_exam: '考试总结',
  change_password: '修改密码',
  reset_password: '重置密码',
  run_test: '系统测速',
}

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
  { label: 'DeepSeek · deepseek-v3.2-exp', value: 'deepseek-v3.2-exp' },
  { label: 'DeepSeek · deepseek-v3.2-exp-thinking', value: 'deepseek-v3.2-exp-thinking' },
  { label: 'DeepSeek · deepseek-v3.2-speciale', value: 'deepseek-v3.2-speciale' },
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
  if (action.type === 'change_password' || action.type === 'reset_password') return false
  if (action.type === 'send_mail' || action.type === 'open_url') return true
  if (action.type === 'generate_questions' && action.payload?.persist) return true
  if (action.type === 'run_test') return true
  return false
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
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const [hydrating, setHydrating] = useState(false)
  const [lastTouchedId, setLastTouchedId] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const saveTimer = useRef<number | null>(null)

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
      onOk: () => window.location.assign('/login'),
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

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    append({ id: String(Date.now()), role: 'user', content: text })
    setLoading(true)
    try {
      const modelToUse = customModel.trim() || model || undefined
      const res: any = await aiApi.agent({
        messages: [...trimmedItems, { role: 'user', content: text }],
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

  const executeAction = async (action: AgentAction) => {
    const run = async () => {
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
      }
    }

    if (needsConfirm(action)) {
      Modal.confirm({
        title: '确认执行操作',
        content: actionSummary(action),
        okText: '执行',
        cancelText: '取消',
        onOk: run,
      })
    } else {
      await run()
    }
  }

  return (
    <>
      <FloatButton
        icon={<MessageOutlined />}
        onClick={() => setOpen(true)}
        tooltip={<div>AI 助手</div>}
      />
      <Drawer
        title="AI 助手"
        placement="right"
        width={360}
        onClose={() => setOpen(false)}
        open={open}
        extra={
          <Space>
            <Button
              onClick={() => {
                const next = createSession()
                setSessions(prev => [next, ...prev])
                setActiveId(next.id)
                setLastTouchedId(next.id)
              }}
            >
              新建对话
            </Button>
            <Button
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
            >
              删除当前
            </Button>
            <Button
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
            >
              清空
            </Button>
          </Space>
        }
      >
        <Space direction="vertical" style={{ width: '100%', marginBottom: 12 }}>
          <Select
            size="middle"
            style={{ width: '100%' }}
            value={activeSession?.id}
            onChange={val => setActiveId(val)}
            options={sessionOptions}
            placeholder="历史对话"
            showSearch
          />
        </Space>
        <Space direction="vertical" style={{ width: '100%', marginBottom: 12 }}>
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
          <Input
            size="middle"
            value={customModel}
            onChange={e => setCustomModel(e.target.value)}
            placeholder="自定义模型（优先生效）"
          />
          {(customModel.trim() || model) && (
            <Text type="secondary">当前模型：{customModel.trim() || model}</Text>
          )}
        </Space>
        <div ref={listRef} style={{ maxHeight: '60vh', overflow: 'auto', paddingRight: 8 }}>
          <List
            dataSource={items}
            renderItem={item => (
              <List.Item style={{ justifyContent: item.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '85%' }}>
                  <div
                    style={{
                      background: item.role === 'user' ? '#e6f4ff' : '#f6ffed',
                      border: '1px solid #d9d9d9',
                      padding: '8px 12px',
                      borderRadius: 8,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    <Text>{item.content}</Text>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: item.role === 'user' ? 'flex-end' : 'flex-start',
                      marginTop: 4,
                    }}
                  >
                    <Space size={4}>
                      <Button
                        type="text"
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => handleCopy(item.content)}
                      />
                      {item.role === 'user' && (
                        <Button
                          type="text"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => handleEdit(item.content)}
                        />
                      )}
                    </Space>
                  </div>
                  {item.action && (
                    <div style={{ marginTop: 8 }}>
                      <Space>
                        <Tag color="blue">{ACTION_LABELS[item.action.type] || item.action.type}</Tag>
                        <Text type="secondary">{actionSummary(item.action)}</Text>
                        <Button size="small" onClick={() => executeAction(item.action!)}>
                          执行
                        </Button>
                      </Space>
                    </div>
                  )}
                </div>
              </List.Item>
            )}
          />
        </div>
        <div style={{ marginTop: 12 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <TextArea
              rows={3}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="问我任何问题，例如：帮我生成5道单选题，或跳转到题库页面"
              ref={inputRef}
              onPressEnter={e => {
                if (!e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
            />
            <Button type="primary" icon={<SendOutlined />} loading={loading} onClick={send}>
              发送
            </Button>
          </Space>
        </div>
      </Drawer>
    </>
  )
}
