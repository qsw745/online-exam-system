// src/shared/contexts/AuthContext.tsx
import {
  clearTokenAll,
  getAuthStorageFlag,
  setAuthStorageFlag,
  getAccessToken as storageGetAccessToken,
  setAccessToken as storageSetAccessToken,
  USER_ROLE_KEY,
  type AuthStorageMode,
} from '@/shared/api/core/storage'
import { menuApi } from '@/shared/api/endpoints/menu'
import { auth, users } from '@/shared/api/http'
import React, { createContext, useContext, useEffect, useState } from 'react'

interface User {
  id: string
  email: string
  role: string
  username?: string
  nickname?: string
  school?: string
  class_name?: string
  avatar_url?: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (
    email: string,
    password: string,
    keep7Days?: boolean,
    extra?: { captcha?: string; captchaId?: string; enc?: string; alg?: string; keep7Days?: boolean }
  ) => Promise<void>
  signUp: (email: string, password: string, username: string, role: string) => Promise<void>
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
  reload: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/** ============== 工具 ============== */
function decodeExp(token: string): number | null {
  try {
    const base64Url = token.split('.')[1]
    if (!base64Url) return null
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    const payload = JSON.parse(jsonPayload)
    return typeof payload?.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

function writeRole(role?: string | null) {
  if (role) {
    localStorage.setItem(USER_ROLE_KEY, role)
    sessionStorage.setItem(USER_ROLE_KEY, role)
  } else {
    localStorage.removeItem(USER_ROLE_KEY)
    sessionStorage.removeItem(USER_ROLE_KEY)
  }
}

/** 仅清 token 与角色，不碰“记住我/7天免登录/失败计数” */
function clearAllAuthSoft() {
  try {
    clearTokenAll()
    writeRole(null)
  } catch {}
}

/** ✅ 标签持久化键，并提供清除函数 */
const TABS_LS_LIST = 'tabs:v2:list'
const TABS_LS_ACTIVE = 'tabs:v2:active'
function clearTabsPersistence() {
  try {
    localStorage.removeItem(TABS_LS_LIST)
    localStorage.removeItem(TABS_LS_ACTIVE)
  } catch {}
}

/** ============== Provider ============== */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = async () => {
    const me = await users.getCurrentUser()
    if ('success' in me && me.success) {
      const u = me.data as any
      if (!u.role) {
        const r = localStorage.getItem(USER_ROLE_KEY) || sessionStorage.getItem(USER_ROLE_KEY)
        if (r) u.role = r
      }
      if (u.role) writeRole(u.role)
      setUser(u)
      return
    }

    const refreshed = await auth.refresh()
    if ('success' in refreshed && refreshed.success && (refreshed.data as any)?.token) {
      const newToken = (refreshed.data as any).token as string
      const flag = getAuthStorageFlag()
      storageSetAccessToken(newToken, flag)
      const me2 = await users.getCurrentUser()
      if ('success' in me2 && me2.success) {
        const u2 = me2.data as any
        if (!u2.role) {
          const r = localStorage.getItem(USER_ROLE_KEY) || sessionStorage.getItem(USER_ROLE_KEY)
          if (r) u2.role = r
        }
        if (u2.role) writeRole(u2.role)
        setUser(u2)
        return
      }
    }

    // ❗ 刷新失败：清凭据 + 清标签
    clearAllAuthSoft()
    clearTabsPersistence()
    setUser(null)
  }

  useEffect(() => {
    ;(async () => {
      const token = storageGetAccessToken()
      if (!token) {
        writeRole(null)
        setLoading(false)
        return
      }
      const expMs = decodeExp(token)
      const isExpired = expMs !== null && Date.now() >= expMs
      try {
        if (isExpired) {
          const refreshed = await auth.refresh()
          if ('success' in refreshed && refreshed.success && (refreshed.data as any)?.token) {
            const flag = getAuthStorageFlag()
            storageSetAccessToken((refreshed.data as any).token as string, flag)
          } else {
            // ❗ 初始刷新失败：清凭据 + 清标签
            clearAllAuthSoft()
            clearTabsPersistence()
            setUser(null)
            setLoading(false)
            return
          }
        }
        await refreshUser()
      } catch {
        clearAllAuthSoft()
        clearTabsPersistence()
        setUser(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const signIn = async (
    email: string,
    password: string,
    keep7Days = false,
    extra?: { captcha?: string; captchaId?: string; enc?: string; alg?: string; keep7Days?: boolean }
  ) => {
    const mode: AuthStorageMode = keep7Days ? '7d' : 'session'
    setAuthStorageFlag(mode)

    const result = await auth.login(email, password, { ...(extra ?? {}), keep7Days })
    if ((result as any)?.success === false) throw new Error((result as any).error || '登录失败')

    const payload = (result as any)?.data ?? (result as any) ?? {}
    const token: string | undefined = payload.token ?? payload.access_token ?? payload.accessToken ?? payload.jwt
    const userData: User | undefined = payload.user
    if (!token || !userData) throw new Error('登录响应缺少 token 或用户信息')

    storageSetAccessToken(token, mode)
    if ((userData as any)?.role) {
      localStorage.setItem(USER_ROLE_KEY, (userData as any).role)
      sessionStorage.setItem(USER_ROLE_KEY, (userData as any).role)
    }
    setUser(userData)
  }

  const signUp = async (email: string, password: string, username: string, role: string) => {
    const result = await auth.register({ email, password, username, role })
    if ((result as any)?.success === false) throw new Error((result as any).error || '注册失败')

    const payload = (result as any)?.data ?? (result as any) ?? {}
    const token: string | undefined = payload.token ?? payload.access_token ?? payload.accessToken ?? payload.jwt
    const userData: User | undefined = payload.user
    if (!token || !userData) throw new Error('注册响应缺少 token 或用户信息')

    setAuthStorageFlag('7d')
    storageSetAccessToken(token, '7d')
    writeRole((userData as any).role || role)
    setUser(userData)
  }

  const signOut = async () => {
    try {
      await auth.logout()
    } catch {}
    // ✅ 退出登录：清凭据 + 清标签 + 清动态路由缓存
    clearAllAuthSoft()
    // ✅ 同步清理菜单缓存（可选，但强烈建议）
    menuApi.clearUserMenusCache()

    clearTabsPersistence()
    setUser(null)
    menuApi.clearRouteTreeCache?.()
  }

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    refreshUser,
    reload: refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
