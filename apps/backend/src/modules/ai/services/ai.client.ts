import { getAiRuntimeSettings } from './ai.settings'

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }
export type ChatOptions = {
  messages: ChatMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
  jsonObject?: boolean
  timeoutMs?: number
}

type ChatResponse = {
  content: string
  usage?: any
  raw: any
}

async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fn(ctrl.signal)
  } finally {
    clearTimeout(timer)
  }
}

export async function chatCompletion(opts: ChatOptions): Promise<ChatResponse> {
  if (typeof fetch !== 'function') throw new Error('fetch is not available in current runtime')

  const settings = await getAiRuntimeSettings(opts.model)
  const isLocal = settings.provider === 'local'
  const isOllama = isLocal && settings.localProvider === 'ollama'
  if (!settings.enabled) throw new Error('AI feature is disabled')
  if (!settings.apiKey && !isLocal) throw new Error('AI_API_KEY is not set')

  if (isOllama) {
    const payload: any = {
      model: settings.model,
      messages: opts.messages,
      stream: false,
      options: {
        temperature: typeof opts.temperature === 'number' ? opts.temperature : settings.temperature,
        num_predict: typeof opts.maxTokens === 'number' ? opts.maxTokens : settings.maxTokens,
      },
    }
    if (opts.jsonObject) payload.format = 'json'
    const url = `${settings.baseUrl}/api/chat`
    const resp = await withTimeout(
      signal =>
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal,
        }),
      typeof opts.timeoutMs === 'number' ? opts.timeoutMs : settings.timeoutMs
    )
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      if (resp.status === 401 || resp.status === 403) {
        throw new Error(
          `AI 服务认证失败（${resp.status}）：API Key 无效或所选模型无权限，请在后台「系统设置 → AI」检查密钥/接口地址/模型`
        )
      }
      throw new Error(`AI 服务调用失败（${resp.status} ${resp.statusText}）：${String(text).slice(0, 200)}`)
    }
    const json = await resp.json()
    const content = json?.message?.content ?? ''
    const usage = {
      prompt_eval_count: json?.prompt_eval_count,
      eval_count: json?.eval_count,
      total_duration: json?.total_duration,
    }
    return { content, usage, raw: json }
  }

  const payload: any = {
    model: settings.model,
    messages: opts.messages,
    temperature: typeof opts.temperature === 'number' ? opts.temperature : settings.temperature,
    max_tokens: typeof opts.maxTokens === 'number' ? opts.maxTokens : settings.maxTokens,
  }
  if (opts.jsonObject && !isLocal) payload.response_format = { type: 'json_object' }
  if (settings.provider === 'deepseek' && settings.thinkingMode) {
    payload.thinking = { type: settings.thinkingMode }
  }

  const url = `${settings.baseUrl}/chat/completions`
  const resp = await withTimeout(
    signal =>
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}),
        },
        body: JSON.stringify(payload),
        signal,
      }),
    typeof opts.timeoutMs === 'number' ? opts.timeoutMs : settings.timeoutMs
  )

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    if (resp.status === 401 || resp.status === 403) {
      throw new Error(
        `AI 服务认证失败（${resp.status}）：API Key 无效或所选模型无权限，请在后台「系统设置 → AI」检查密钥/接口地址/模型`
      )
    }
    throw new Error(`AI 服务调用失败（${resp.status} ${resp.statusText}）：${String(text).slice(0, 200)}`)
  }

  const json = await resp.json()
  const content = json?.choices?.[0]?.message?.content ?? ''
  return { content, usage: json?.usage, raw: json }
}

/**
 * 流式对话：逐段回调 onDelta，返回完整内容。
 * OpenAI 兼容（deepseek/openai/custom）走 SSE；Ollama 走 NDJSON。
 */
export async function chatCompletionStream(
  opts: ChatOptions,
  onDelta: (text: string) => void
): Promise<ChatResponse> {
  if (typeof fetch !== 'function') throw new Error('fetch is not available in current runtime')

  const settings = await getAiRuntimeSettings(opts.model)
  const isLocal = settings.provider === 'local'
  const isOllama = isLocal && settings.localProvider === 'ollama'
  if (!settings.enabled) throw new Error('AI feature is disabled')
  if (!settings.apiKey && !isLocal) throw new Error('AI_API_KEY is not set')

  const timeoutMs = typeof opts.timeoutMs === 'number' ? opts.timeoutMs : settings.timeoutMs

  const url = isOllama ? `${settings.baseUrl}/api/chat` : `${settings.baseUrl}/chat/completions`
  const payload: any = isOllama
    ? {
        model: settings.model,
        messages: opts.messages,
        stream: true,
        options: {
          temperature: typeof opts.temperature === 'number' ? opts.temperature : settings.temperature,
          num_predict: typeof opts.maxTokens === 'number' ? opts.maxTokens : settings.maxTokens,
        },
      }
    : {
        model: settings.model,
        messages: opts.messages,
        temperature: typeof opts.temperature === 'number' ? opts.temperature : settings.temperature,
        max_tokens: typeof opts.maxTokens === 'number' ? opts.maxTokens : settings.maxTokens,
        stream: true,
      }
  if (!isOllama && settings.provider === 'deepseek' && settings.thinkingMode) {
    payload.thinking = { type: settings.thinkingMode }
  }

  return withTimeout(async signal => {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(!isOllama && settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}),
      },
      body: JSON.stringify(payload),
      signal,
    })
    if (!resp.ok || !resp.body) {
      const text = await resp.text().catch(() => '')
      if (resp.status === 401 || resp.status === 403) {
        throw new Error(
          `AI 服务认证失败（${resp.status}）：API Key 无效或所选模型无权限，请在后台「系统设置 → AI」检查密钥/接口地址/模型`
        )
      }
      throw new Error(`AI 服务调用失败（${resp.status} ${resp.statusText}）：${String(text).slice(0, 200)}`)
    }

    const reader = (resp.body as any).getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let content = ''
    let usage: any

    const handleLine = (line: string) => {
      const trimmed = line.trim()
      if (!trimmed) return
      if (isOllama) {
        try {
          const json = JSON.parse(trimmed)
          const piece = json?.message?.content
          if (piece) {
            content += piece
            onDelta(piece)
          }
          if (json?.done) {
            usage = {
              prompt_eval_count: json?.prompt_eval_count,
              eval_count: json?.eval_count,
              total_duration: json?.total_duration,
            }
          }
        } catch {}
        return
      }
      if (!trimmed.startsWith('data:')) return
      const dataStr = trimmed.slice(5).trim()
      if (dataStr === '[DONE]') return
      try {
        const json = JSON.parse(dataStr)
        const piece = json?.choices?.[0]?.delta?.content
        if (piece) {
          content += piece
          onDelta(piece)
        }
        if (json?.usage) usage = json.usage
      } catch {}
    }

    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let idx: number
      while ((idx = buffer.indexOf('\n')) !== -1) {
        handleLine(buffer.slice(0, idx))
        buffer = buffer.slice(idx + 1)
      }
    }
    if (buffer) handleLine(buffer)

    return { content, usage, raw: null }
  }, timeoutMs)
}

export async function embedTexts(texts: string[], model?: string): Promise<number[][]> {
  if (typeof fetch !== 'function') throw new Error('fetch is not available in current runtime')
  const settings = await getAiRuntimeSettings(model)
  const isLocal = settings.provider === 'local'
  const isOllama = isLocal && settings.localProvider === 'ollama'
  if (!settings.enabled) throw new Error('AI feature is disabled')
  if (!settings.apiKey && !isLocal) throw new Error('AI_API_KEY is not set')
  const input = Array.isArray(texts) ? texts.map(t => String(t || '')) : []
  if (!input.length) return []

  if (isOllama) {
    const url = `${settings.baseUrl}/api/embeddings`
    const results = await Promise.all(
      input.map(async prompt => {
        const resp = await withTimeout(
          signal =>
            fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: settings.model, prompt }),
              signal,
            }),
          settings.timeoutMs
        )
        if (!resp.ok) {
          const text = await resp.text().catch(() => '')
          throw new Error(`AI embedding failed: ${resp.status} ${resp.statusText} ${text}`)
        }
        const json = await resp.json()
        return Array.isArray(json?.embedding) ? json.embedding.map(Number) : []
      })
    )
    return results
  }

  const payload: any = {
    model: settings.model,
    input,
  }

  const url = `${settings.baseUrl}/embeddings`
  const resp = await withTimeout(
    signal =>
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}),
        },
        body: JSON.stringify(payload),
        signal,
      }),
    settings.timeoutMs
  )

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`AI embedding failed: ${resp.status} ${resp.statusText} ${text}`)
  }

  const json = await resp.json()
  const data = Array.isArray(json?.data) ? json.data : []
  return data.map((d: any) => (Array.isArray(d?.embedding) ? d.embedding.map(Number) : []))
}
