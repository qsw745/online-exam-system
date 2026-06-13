/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  AI_ALLOWED_MODELS,
  AI_API_KEY,
  AI_BASE_URL,
  AI_BASE_URL_LOCAL,
  AI_BASE_URL_REMOTE,
  AI_ENABLED,
  AI_LOCAL_PROVIDER,
  AI_MAX_TOKENS,
  AI_MODEL,
  AI_PROVIDER,
  AI_TEMPERATURE,
  AI_TIMEOUT_MS,
} from '@/config/ai'
import { AdminSettingsRepository } from '@/modules/admin-settings/repositories/admin-settings.repository'

export type AiProvider = 'deepseek' | 'openai' | 'custom' | 'local'
export type AiThinkingMode = 'enabled' | 'disabled'

export type AiRuntimeSettings = {
  enabled: boolean
  provider: AiProvider
  baseUrl: string
  apiKey: string
  model: string
  allowedModels: string[]
  temperature: number
  maxTokens: number
  timeoutMs: number
  thinkingMode?: AiThinkingMode
  localProvider: string
}

const providerBaseUrl: Record<AiProvider, string> = {
  deepseek: 'https://api.deepseek.com',
  openai: 'https://api.openai.com/v1',
  custom: AI_BASE_URL_REMOTE || AI_BASE_URL,
  local: AI_BASE_URL_LOCAL,
}

const trim = (value: any) => String(value ?? '').trim()
const cleanBaseUrl = (value: any) => trim(value).replace(/\/+$/, '')

const num = (value: any, fallback: number, min: number, max: number) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

const normalizeProvider = (value: any): AiProvider => {
  const provider = trim(value).toLowerCase()
  if (provider === 'deepseek' || provider === 'openai' || provider === 'custom' || provider === 'local') return provider
  if (provider === 'remote') return 'deepseek'
  return 'deepseek'
}

const normalizeThinkingMode = (value: any): AiThinkingMode | undefined => {
  const mode = trim(value).toLowerCase()
  if (mode === 'enabled' || mode === 'disabled') return mode
  return undefined
}

const splitModels = (value: any): string[] =>
  (Array.isArray(value) ? value : trim(value).split(','))
    .map((item: any) => trim(item))
    .filter(Boolean)
    .filter((item: string, index: number, arr: string[]) => arr.indexOf(item) === index)

const resolveModel = (input: string | undefined, fallback: string, allowedModels: string[]) => {
  const requested = trim(input)
  if (requested && (!allowedModels.length || allowedModels.includes(requested))) return requested
  return fallback
}

export async function getAiRuntimeSettings(modelOverride?: string): Promise<AiRuntimeSettings> {
  let settings: any = {}
  try {
    settings = await AdminSettingsRepository.get()
  } catch {
    settings = {}
  }

  const provider = normalizeProvider(settings.aiProvider || AI_PROVIDER)
  const baseUrl = cleanBaseUrl(settings.aiBaseUrl) || providerBaseUrl[provider]
  const apiKey = trim(settings.aiApiKey) || AI_API_KEY
  const allowedModels = splitModels(settings.aiAllowedModels).length
    ? splitModels(settings.aiAllowedModels)
    : AI_ALLOWED_MODELS
  const configuredModel = trim(settings.aiModel) || AI_MODEL
  const thinkingMode = normalizeThinkingMode(settings.aiThinkingMode)

  return {
    enabled: typeof settings.aiEnabled === 'boolean' ? settings.aiEnabled : AI_ENABLED,
    provider,
    baseUrl,
    apiKey,
    model: resolveModel(modelOverride, configuredModel, allowedModels),
    allowedModels,
    temperature: num(settings.aiTemperature, AI_TEMPERATURE, 0, 2),
    maxTokens: Math.floor(num(settings.aiMaxTokens, AI_MAX_TOKENS, 1, 100000)),
    timeoutMs: Math.floor(num(settings.aiTimeoutMs, AI_TIMEOUT_MS, 1000, 300000)),
    thinkingMode,
    localProvider: trim(settings.aiLocalProvider || AI_LOCAL_PROVIDER).toLowerCase(),
  }
}
