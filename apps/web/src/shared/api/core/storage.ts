// apps/web/src/shared/api/core/storage.ts
// 统一的鉴权存储工具：支持 'session' | 'local' | '7d(7天免登录)'
import { Capacitor } from '@capacitor/core'

import { resolveAppTarget } from '@/platform/appTarget'
import { nativeSecureSession } from '@/platform/secure-session/nativeSecureSession'
import type { SecureSessionAdapter, StoredNativeSession } from '@/platform/secure-session/secureSession.types'

export const STORAGE_FLAG_KEY = 'auth_storage' // 'session' | 'local' | '7d'
const ACCESS_TOKEN_KEY = 'token'
const TOKEN_EXPIRES_KEY = 'token_expires_at' // 仅 7d 模式使用
export const USER_ROLE_KEY = 'userRole'

export type AuthStorageMode = 'session' | 'local' | '7d'

const sevenDays = 7 * 24 * 60 * 60 * 1000
let secureSessionAdapter: SecureSessionAdapter | null = null
let memorySession: StoredNativeSession | null = null

function clearWebTokenStorage() {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(TOKEN_EXPIRES_KEY)
}

function isExpired(session: StoredNativeSession) {
  return session.mode === '7d' && (!session.expiresAt || Date.now() > session.expiresAt)
}

export async function initializeAuthStorage(adapter?: SecureSessionAdapter) {
  const useNativeStorage = Boolean(adapter) || resolveAppTarget(
    import.meta.env.VITE_APP_TARGET,
    Capacitor.isNativePlatform(),
  ) === 'ios'

  secureSessionAdapter = useNativeStorage ? adapter ?? nativeSecureSession : null
  memorySession = null
  if (!secureSessionAdapter) return

  clearWebTokenStorage()
  const restored = await secureSessionAdapter.read()
  if (!restored) return
  if (!restored.accessToken || !['session', 'local', '7d'].includes(restored.mode) || isExpired(restored)) {
    await secureSessionAdapter.clear()
    return
  }
  memorySession = restored
}

export function setAuthStorageFlag(flag: AuthStorageMode) {
  localStorage.setItem(STORAGE_FLAG_KEY, flag)
}

export function getAuthStorageFlag(): AuthStorageMode {
  const v = localStorage.getItem(STORAGE_FLAG_KEY)
  if (v === 'local' || v === '7d') return v
  return 'session'
}

/**
 * 设置访问令牌。根据当前模式写入 sessionStorage / localStorage。
 * 7d 模式会额外记录一个绝对过期时间（当前时间 + 7 天）。
 */
export async function setAccessToken(token: string, mode: AuthStorageMode = getAuthStorageFlag()) {
  if (secureSessionAdapter) {
    const session: StoredNativeSession = {
      accessToken: token,
      mode,
      expiresAt: mode === '7d' ? Date.now() + sevenDays : null,
    }
    await secureSessionAdapter.write(session)
    memorySession = session
    return
  }

  // 先清理 session 的 token，避免双份
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  if (mode !== '7d') {
    localStorage.removeItem(TOKEN_EXPIRES_KEY)
  }

  if (mode === 'session') {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, token)
    localStorage.removeItem(ACCESS_TOKEN_KEY)
  } else if (mode === 'local') {
    localStorage.setItem(ACCESS_TOKEN_KEY, token)
  } else {
    // 7天免登录：localStorage 存 token + 过期时间
    localStorage.setItem(ACCESS_TOKEN_KEY, token)
    localStorage.setItem(TOKEN_EXPIRES_KEY, String(Date.now() + sevenDays))
  }
}

/**
 * 读取访问令牌。
 * - session: 读 sessionStorage
 * - local:   读 localStorage
 * - 7d:      读 localStorage，且校验 7 天窗口是否还有效；超过则清空并返回 null
 */
export function getAccessToken(): string | null {
  if (secureSessionAdapter) {
    if (!memorySession) return null
    if (isExpired(memorySession)) {
      memorySession = null
      void secureSessionAdapter.clear()
      return null
    }
    return memorySession.accessToken
  }

  const mode = getAuthStorageFlag()
  if (mode === 'session') {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY)
  }

  const token = localStorage.getItem(ACCESS_TOKEN_KEY)
  if (!token) return null

  if (mode === '7d') {
    const exp = Number(localStorage.getItem(TOKEN_EXPIRES_KEY) || 0)
    if (!exp || Date.now() > exp) {
      // 超过 7 天窗口，彻底清理
      localStorage.removeItem(ACCESS_TOKEN_KEY)
      localStorage.removeItem(TOKEN_EXPIRES_KEY)
      return null
    }
  }
  return token
}

/** 清理 token（无论存哪儿）与 7d 过期时间戳 */
export async function clearTokenAll() {
  if (secureSessionAdapter) {
    memorySession = null
    await secureSessionAdapter.clear()
    return
  }
  clearWebTokenStorage()
  // 角色留给上层统一清理
}
