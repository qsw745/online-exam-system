import {
  AI_API_KEY,
  AI_BASE_URL_LOCAL,
  AI_LOCAL_PROVIDER,
  AI_MAX_TOKENS,
  AI_MODEL,
  AI_TEMPERATURE,
  AI_TIMEOUT_MS,
  resolveAiBaseUrl,
} from '@/config/ai'

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

  const baseUrl = resolveAiBaseUrl(opts.model)
  const isLocal = baseUrl === AI_BASE_URL_LOCAL
  const isOllama = isLocal && AI_LOCAL_PROVIDER === 'ollama'
  if (!AI_API_KEY && !isLocal) throw new Error('AI_API_KEY is not set')

  if (isOllama) {
    const payload: any = {
      model: opts.model || AI_MODEL,
      messages: opts.messages,
      stream: false,
      options: {
        temperature: typeof opts.temperature === 'number' ? opts.temperature : AI_TEMPERATURE,
        num_predict: typeof opts.maxTokens === 'number' ? opts.maxTokens : AI_MAX_TOKENS,
      },
    }
    if (opts.jsonObject) payload.format = 'json'
    const url = `${baseUrl}/api/chat`
    const resp = await withTimeout(
      signal =>
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal,
        }),
      typeof opts.timeoutMs === 'number' ? opts.timeoutMs : AI_TIMEOUT_MS
    )
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(`AI request failed: ${resp.status} ${resp.statusText} ${text}`)
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
    model: opts.model || AI_MODEL,
    messages: opts.messages,
    temperature: typeof opts.temperature === 'number' ? opts.temperature : AI_TEMPERATURE,
    max_tokens: typeof opts.maxTokens === 'number' ? opts.maxTokens : AI_MAX_TOKENS,
  }
  if (opts.jsonObject && !isLocal) payload.response_format = { type: 'json_object' }

  const url = `${baseUrl}/chat/completions`
  const resp = await withTimeout(
    signal =>
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(AI_API_KEY ? { Authorization: `Bearer ${AI_API_KEY}` } : {}),
        },
        body: JSON.stringify(payload),
        signal,
      }),
    typeof opts.timeoutMs === 'number' ? opts.timeoutMs : AI_TIMEOUT_MS
  )

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`AI request failed: ${resp.status} ${resp.statusText} ${text}`)
  }

  const json = await resp.json()
  const content = json?.choices?.[0]?.message?.content ?? ''
  return { content, usage: json?.usage, raw: json }
}

export async function embedTexts(texts: string[], model?: string): Promise<number[][]> {
  if (typeof fetch !== 'function') throw new Error('fetch is not available in current runtime')
  const baseUrl = resolveAiBaseUrl(model)
  const isLocal = baseUrl === AI_BASE_URL_LOCAL
  const isOllama = isLocal && AI_LOCAL_PROVIDER === 'ollama'
  if (!AI_API_KEY && !isLocal) throw new Error('AI_API_KEY is not set')
  const input = Array.isArray(texts) ? texts.map(t => String(t || '')) : []
  if (!input.length) return []

  if (isOllama) {
    const url = `${baseUrl}/api/embeddings`
    const results = await Promise.all(
      input.map(async prompt => {
        const resp = await withTimeout(
          signal =>
            fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: model || AI_MODEL, prompt }),
              signal,
            }),
          AI_TIMEOUT_MS
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
    model: model || AI_MODEL,
    input,
  }

  const url = `${baseUrl}/embeddings`
  const resp = await withTimeout(
    signal =>
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(AI_API_KEY ? { Authorization: `Bearer ${AI_API_KEY}` } : {}),
        },
        body: JSON.stringify(payload),
        signal,
      }),
    AI_TIMEOUT_MS
  )

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`AI embedding failed: ${resp.status} ${resp.statusText} ${text}`)
  }

  const json = await resp.json()
  const data = Array.isArray(json?.data) ? json.data : []
  return data.map((d: any) => (Array.isArray(d?.embedding) ? d.embedding.map(Number) : []))
}
