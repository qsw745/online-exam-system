import type { Request } from 'express'
import { redis } from '@/common/redis/client'

export type OAuthProvider = 'github' | 'google'

export type OAuthProfile = {
  provider: OAuthProvider
  providerUserId: string
  email: string
  emailVerified: boolean
  displayName?: string | null
  avatarUrl?: string | null
}

type StatePayload = {
  provider: OAuthProvider
  redirectUri: string
  next: string
  keep7Days: boolean
  createdAt: number
}

const STATE_TTL_SEC = 10 * 60
const STATE_PREFIX = 'auth:oauth:state:'
const PROVIDERS: OAuthProvider[] = ['github', 'google']

function env(name: string) {
  return String(process.env[name] || '').trim()
}

function base64Url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString('base64url')
}

function randomToken(bytes = 32) {
  const array = new Uint8Array(bytes)
  globalThis.crypto.getRandomValues(array)
  return base64Url(array)
}

function providerConfig(provider: OAuthProvider) {
  if (provider === 'github') {
    return {
      clientId: env('GITHUB_OAUTH_CLIENT_ID') || env('GITHUB_CLIENT_ID'),
      clientSecret: env('GITHUB_OAUTH_CLIENT_SECRET') || env('GITHUB_CLIENT_SECRET'),
    }
  }
  return {
    clientId: env('GOOGLE_OAUTH_CLIENT_ID') || env('GOOGLE_CLIENT_ID'),
    clientSecret: env('GOOGLE_OAUTH_CLIENT_SECRET') || env('GOOGLE_CLIENT_SECRET'),
  }
}

function isEnabled(provider: OAuthProvider) {
  const cfg = providerConfig(provider)
  return !!(cfg.clientId && cfg.clientSecret)
}

function originFromRequest(req: Request) {
  const proto = String(req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim()
  const host = String(req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim()
  return `${proto}://${host}`
}

function normalizeMountPath(raw?: string) {
  let value = String(raw || '').trim()
  if (!value) return ''
  try {
    if (/^https?:\/\//i.test(value)) value = new URL(value).pathname
  } catch {}
  value = `/${value.replace(/^\/+/, '').replace(/\/+$/, '')}`
  return value === '/' ? '' : value
}

function appBasePathFromRequest(req: Request) {
  const forwardedPrefix = normalizeMountPath(req.get('x-exam-public-prefix') || req.get('x-forwarded-prefix'))
  if (forwardedPrefix) return forwardedPrefix
  const path = (req.originalUrl || req.url || '').split('?')[0]
  const apiIdx = path.indexOf('/api/')
  if (apiIdx > 0) return normalizeMountPath(path.slice(0, apiIdx))
  return normalizeMountPath(process.env.WEB_BASE_PATH)
}

function callbackPath(req: Request, provider: OAuthProvider) {
  const forwardedPrefix = normalizeMountPath(req.get('x-exam-public-prefix') || req.get('x-forwarded-prefix'))
  const baseUrl = normalizeMountPath(req.baseUrl || '/api/auth')
  const publicBaseUrl =
    forwardedPrefix && baseUrl !== forwardedPrefix && !baseUrl.startsWith(`${forwardedPrefix}/`)
      ? `${forwardedPrefix}${baseUrl}`
      : baseUrl
  return `${publicBaseUrl}/oauth/${provider}/callback`
}

function sanitizeNext(raw: unknown) {
  const next = String(raw || '/dashboard').trim()
  if (!next || next.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(next)) return '/dashboard'
  return next.startsWith('/') ? next : `/${next}`
}

function frontendCallbackUrl(req: Request, params: Record<string, string>) {
  const configured = env('OAUTH_FRONTEND_URL')
  const origin = configured ? configured.replace(/\/+$/, '') : originFromRequest(req)
  const appBase = configured ? '' : appBasePathFromRequest(req)
  const url = new URL(`${origin}${appBase}/oauth/callback`)
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value)
  }
  return url.toString()
}

async function fetchJson(url: string, init: RequestInit, timeoutMs = 10_000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const resp = await fetch(url, { ...init, signal: controller.signal })
    const text = await resp.text()
    let data: any = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = { raw: text }
    }
    if (!resp.ok) {
      throw new Error(data?.error_description || data?.error || `OAuth provider request failed: ${resp.status}`)
    }
    return data
  } finally {
    clearTimeout(timer)
  }
}

async function exchangeGitHubCode(code: string, redirectUri: string) {
  const cfg = providerConfig('github')
  const token = await fetchJson('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  })
  const accessToken = token?.access_token
  if (!accessToken) throw new Error('GitHub OAuth token missing')

  const user = await fetchJson('https://api.github.com/user', {
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${accessToken}` },
  })
  const emails = await fetchJson('https://api.github.com/user/emails', {
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${accessToken}` },
  })
  const primary = Array.isArray(emails)
    ? emails.find((item: any) => item?.primary && item?.verified && item?.email) ||
      emails.find((item: any) => item?.verified && item?.email)
    : null
  if (!primary?.email) throw new Error('GitHub account has no verified email')

  return {
    provider: 'github' as const,
    providerUserId: String(user.id),
    email: String(primary.email).toLowerCase(),
    emailVerified: true,
    displayName: user.name || user.login || null,
    avatarUrl: user.avatar_url || null,
  }
}

async function exchangeGoogleCode(code: string, redirectUri: string) {
  const cfg = providerConfig('google')
  const token = await fetchJson('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  const accessToken = token?.access_token
  if (!accessToken) throw new Error('Google OAuth token missing')

  const user = await fetchJson('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!user?.email || user.email_verified !== true) throw new Error('Google account email is not verified')

  return {
    provider: 'google' as const,
    providerUserId: String(user.sub),
    email: String(user.email).toLowerCase(),
    emailVerified: true,
    displayName: user.name || null,
    avatarUrl: user.picture || null,
  }
}

export const OAuthService = {
  normalizeProvider(raw: unknown): OAuthProvider | null {
    const provider = String(raw || '').toLowerCase()
    return provider === 'github' || provider === 'google' ? provider : null
  },

  providers() {
    return PROVIDERS.map(provider => ({ provider, enabled: isEnabled(provider) }))
  },

  async createAuthorization(provider: OAuthProvider, req: Request) {
    if (!isEnabled(provider)) throw new Error(`${provider} OAuth is not configured`)
    const state = randomToken()
    const redirectUri = `${originFromRequest(req)}${callbackPath(req, provider)}`
    const payload: StatePayload = {
      provider,
      redirectUri,
      next: sanitizeNext(req.query?.next),
      keep7Days: String(req.query?.keep7Days || '') === '1' || String(req.query?.keep7Days || '') === 'true',
      createdAt: Date.now(),
    }
    await redis.setex(`${STATE_PREFIX}${state}`, STATE_TTL_SEC, JSON.stringify(payload))

    const cfg = providerConfig(provider)
    const url =
      provider === 'github'
        ? new URL('https://github.com/login/oauth/authorize')
        : new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.searchParams.set('client_id', cfg.clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('state', state)
    if (provider === 'github') {
      url.searchParams.set('scope', 'read:user user:email')
      url.searchParams.set('allow_signup', 'true')
    } else {
      url.searchParams.set('scope', 'openid email profile')
      url.searchParams.set('access_type', 'online')
      url.searchParams.set('prompt', 'select_account')
    }
    return { state, url: url.toString(), ttlSec: STATE_TTL_SEC }
  },

  async consumeCallback(provider: OAuthProvider, req: Request) {
    const code = String(req.query?.code || '')
    const state = String(req.query?.state || '')
    const cookieState = String((req as any)?.cookies?.oauth_state || '')
    if (!code || !state || !cookieState || state !== cookieState) throw new Error('Invalid OAuth state')

    const key = `${STATE_PREFIX}${state}`
    const raw = await redis.get(key)
    await redis.del(key)
    if (!raw) throw new Error('OAuth state expired')
    const payload = JSON.parse(raw) as StatePayload
    if (payload.provider !== provider) throw new Error('OAuth provider mismatch')

    const profile =
      provider === 'github'
        ? await exchangeGitHubCode(code, payload.redirectUri)
        : await exchangeGoogleCode(code, payload.redirectUri)
    return { profile, keep7Days: payload.keep7Days, next: payload.next }
  },

  frontendCallbackUrl,
}
