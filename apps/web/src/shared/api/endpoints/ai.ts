import { api, API_URL } from '../core/httpClient'
import { getAccessToken } from '../core/storage'
import type { ApiResult } from '../core/types'

const AI_TIMEOUT_MS =
  Number((typeof import.meta !== 'undefined' && (import.meta as any)?.env?.VITE_AI_TIMEOUT_MS) || 60000) || 60000

export type AgentStreamHandlers = {
  onStage?: (stage: { key: string; label?: string }) => void
  onDelta?: (text: string) => void
  onAction?: (action: any) => void
  onDone?: (info?: { usage?: any }) => void
}

/**
 * SSE 消费 /ai/agent/stream：把处理阶段与回复增量实时回调给调用方。
 * 网络/服务不支持时抛错，由调用方回退到非流式 agent()。
 */
async function agentStream(
  payload: {
    messages: Array<{ role: string; content: string }>
    model?: string
    sessionId?: string
    /** 多步循环的系统续跑指令：后端跳过规则路由与缓存 */
    internal?: boolean
  },
  handlers: AgentStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const isDev = typeof import.meta !== 'undefined' && !!(import.meta as any)?.env?.DEV
  const base = isDev ? '/api' : API_URL
  const token = getAccessToken()
  const resp = await fetch(`${base}/ai/agent/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
    signal,
  })
  if (!resp.ok || !resp.body) {
    const text = await resp.text().catch(() => '')
    throw new Error(text.slice(0, 200) || `AI 流式请求失败（${resp.status}）`)
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let streamError: Error | null = null

  const handleEvent = (block: string) => {
    let event = 'message'
    const dataLines: string[] = []
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
    }
    if (!dataLines.length) return
    let data: any = {}
    try {
      data = JSON.parse(dataLines.join('\n'))
    } catch {
      return
    }
    if (event === 'stage') handlers.onStage?.(data)
    else if (event === 'delta') handlers.onDelta?.(String(data?.text ?? ''))
    else if (event === 'action') handlers.onAction?.(data)
    else if (event === 'done') handlers.onDone?.(data)
    else if (event === 'error') streamError = new Error(String(data?.message || 'AI 助手失败'))
  }

  // SSE 事件以空行分隔；按块解析
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let idx: number
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      if (block.trim()) handleEvent(block)
      if (streamError) throw streamError
    }
  }
  if (buffer.trim()) handleEvent(buffer)
  if (streamError) throw streamError
}

export const aiApi = {
  agentStream,
  chat: (payload: { prompt?: string; messages?: any[] }) =>
    api.post('/ai/chat', payload, { timeout: AI_TIMEOUT_MS }) as Promise<ApiResult<any>>,
  agent: (payload: {
    messages: Array<{ role: string; content: string }>
    context?: any
    model?: string
    sessionId?: string
    internal?: boolean
  }) =>
    api.post('/ai/agent', payload, { timeout: AI_TIMEOUT_MS }) as Promise<ApiResult<any>>,
  generateQuestions: (payload: any) =>
    api.post('/ai/questions/generate', payload, { timeout: AI_TIMEOUT_MS }) as Promise<ApiResult<any>>,
  generateQuestionsAsync: (payload: any) =>
    api.post('/ai/questions/generate/async', payload) as Promise<ApiResult<any>>,
  getQuestionJob: (id: string) =>
    api.get(`/ai/questions/generate/jobs/${encodeURIComponent(id)}`) as Promise<ApiResult<any>>,
  /** 把最近一次预览生成的题目正式入库（后台任务，复用 getQuestionJob 轮询） */
  persistPreviewAsync: () =>
    api.post('/ai/questions/preview/persist/async', {}) as Promise<ApiResult<any>>,
  explainQuestion: (payload: any) =>
    api.post('/ai/questions/explain', payload, { timeout: AI_TIMEOUT_MS }) as Promise<ApiResult<any>>,
  gradeShortAnswer: (payload: any) =>
    api.post('/ai/answers/grade', payload, { timeout: AI_TIMEOUT_MS }) as Promise<ApiResult<any>>,
  examSummary: (payload: any) =>
    api.post('/ai/exams/summary', payload, { timeout: AI_TIMEOUT_MS }) as Promise<ApiResult<any>>,
  studyPlan: (payload: any) =>
    api.post('/ai/study/plan', payload, { timeout: AI_TIMEOUT_MS }) as Promise<ApiResult<any>>,
  suggestPaper: (payload: any) =>
    api.post('/ai/papers/suggest', payload, { timeout: AI_TIMEOUT_MS }) as Promise<ApiResult<any>>,
  listSessions: () => api.get('/ai/sessions') as Promise<ApiResult<any>>,
  saveSession: (id: string, payload: { title?: string; items?: any[] }) =>
    api.put(`/ai/sessions/${encodeURIComponent(id)}`, payload) as Promise<ApiResult<any>>,
  deleteSession: (id: string) => api.delete(`/ai/sessions/${encodeURIComponent(id)}`) as Promise<ApiResult<any>>,
  addKnowledge: (payload: { title?: string; content: string; tags?: string; source?: string }) =>
    api.post('/ai/knowledge', payload) as Promise<ApiResult<any>>,
  listKnowledge: (params?: { page?: number; limit?: number }) =>
    api.get('/ai/knowledge', { params }) as Promise<ApiResult<any>>,
  searchKnowledge: (payload: { query: string; topK?: number }) =>
    api.post('/ai/knowledge/search', payload) as Promise<ApiResult<any>>,
}
