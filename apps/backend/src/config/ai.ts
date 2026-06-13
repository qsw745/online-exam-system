/* eslint-disable @typescript-eslint/no-explicit-any */
declare const process: any

const num = (v: any, fallback: number) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

export const AI_BASE_URL = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '')
export const AI_BASE_URL_REMOTE = (process.env.AI_BASE_URL_REMOTE || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '')
export const AI_BASE_URL_LOCAL = (process.env.AI_BASE_URL_LOCAL || 'http://127.0.0.1:11434/v1').replace(/\/+$/, '')
export const AI_LOCAL_PROVIDER = String(process.env.AI_LOCAL_PROVIDER || 'openai').toLowerCase()
export const AI_PROVIDER = String(process.env.AI_PROVIDER || 'deepseek').toLowerCase()
export const AI_API_KEY = process.env.AI_API_KEY || process.env.DEEPSEEK_API_KEY || ''
export const AI_MODEL = process.env.AI_MODEL || 'deepseek-v4-flash'
export const AI_EMBEDDING_MODEL = process.env.AI_EMBEDDING_MODEL || ''
export const AI_TEMPERATURE = num(process.env.AI_TEMPERATURE, 0.2)
export const AI_MAX_TOKENS = num(process.env.AI_MAX_TOKENS, 1200)
export const AI_TIMEOUT_MS = num(process.env.AI_TIMEOUT_MS, 60000)
export const AI_QUESTION_TIMEOUT_MS = num(process.env.AI_QUESTION_TIMEOUT_MS, AI_TIMEOUT_MS)
export const AI_CACHE_TTL_SEC = num(process.env.AI_CACHE_TTL_SEC, 600)
export const AI_RAG_TOP_K = num(process.env.AI_RAG_TOP_K, 3)
export const AI_RAG_MAX_CHARS = num(process.env.AI_RAG_MAX_CHARS, 1800)
export const AI_RAG_ENABLED = String(process.env.AI_RAG_ENABLED ?? 'true').toLowerCase() !== 'false'
export const AI_QUESTION_BATCH_SIZE = num(process.env.AI_QUESTION_BATCH_SIZE, 10)
export const AI_QUESTION_BATCH_MAX = num(process.env.AI_QUESTION_BATCH_MAX, 20)
export const AI_QUESTION_MAX_REQUESTS = num(process.env.AI_QUESTION_MAX_REQUESTS, 3)
export const AI_JOB_CONCURRENCY = num(process.env.AI_JOB_CONCURRENCY, 2)
export const AI_LOG_RETENTION_DAYS = num(process.env.AI_LOG_RETENTION_DAYS, 180)
export const AI_ENABLED = String(process.env.AI_ENABLED ?? 'true').toLowerCase() !== 'false'
export const AI_ALLOWED_MODELS = (process.env.AI_ALLOWED_MODELS || '')
  .split(',')
  .map((s: string) => s.trim())
  .filter((v: string) => Boolean(v))
  .filter((v: string, i: number, arr: string[]) => arr.indexOf(v) === i)
export const AI_LOCAL_MODELS = (process.env.AI_LOCAL_MODELS || '')
  .split(',')
  .map((s: string) => s.trim())
  .filter((v: string) => Boolean(v))
  .filter((v: string, i: number, arr: string[]) => arr.indexOf(v) === i)

export function ensureAiEnabled() {
  // Runtime AI settings can be changed from the admin console. The actual
  // enabled/API-key checks happen inside ai.client after those settings load.
}

export function resolveAiModel(input?: string) {
  const m = (input || '').trim()
  if (m && AI_ALLOWED_MODELS.length > 0 && AI_ALLOWED_MODELS.includes(m)) return m
  if (m && AI_ALLOWED_MODELS.length === 0) return m
  return AI_MODEL
}

export function resolveAiBaseUrl(model?: string) {
  const m = (model || '').trim()
  if (AI_PROVIDER === 'local') return AI_BASE_URL_LOCAL
  if (m && AI_LOCAL_MODELS.includes(m)) return AI_BASE_URL_LOCAL
  return AI_BASE_URL_REMOTE
}
