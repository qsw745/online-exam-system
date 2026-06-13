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
    throw new Error(`AI request failed: ${resp.status} ${resp.statusText} ${text}`)
  }

  const json = await resp.json()
  const content = json?.choices?.[0]?.message?.content ?? ''
  return { content, usage: json?.usage, raw: json }
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
