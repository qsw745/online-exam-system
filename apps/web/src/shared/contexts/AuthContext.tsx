import React, { createContext, useContext, useEffect, useState } from 'react'
import { auth, users } from '@shared/api/http'

interface User {
  id: string
  email: string
  role: string
  username?: string
  // ↓ 可选字段
  school?: string
  class_name?: string
  avatar_url?: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>
  signUp: (email: string, password: string, username: string, role: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const STORAGE_FLAG_KEY = 'auth_storage' // 'local' | 'session'
const ACCESS_TOKEN_KEY = 'token'
const USER_ROLE_KEY = 'userRole'

function getPreferredStorage(): Storage {
  const pref = localStorage.getItem(STORAGE_FLAG_KEY)
  if (pref === 'local') return localStorage
  if (pref === 'session') return sessionStorage
  // 兜底：如果 local 里已有 token 则沿用 local，否则用 session
  if (localStorage.getItem(ACCESS_TOKEN_KEY)) return localStorage
  return sessionStorage
}

function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY) || sessionStorage.getItem(ACCESS_TOKEN_KEY)
}

function setAccessToken(token: string) {
  const st = getPreferredStorage()
  st.setItem(ACCESS_TOKEN_KEY, token)
  // 保证另一边清理
  if (st === localStorage) sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  else localStorage.removeItem(ACCESS_TOKEN_KEY)
}

function clearAccessToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
}

function setRole(role?: string | null) {
  const st = getPreferredStorage()
  if (role) {
    st.setItem(USER_ROLE_KEY, role)
    if (st === localStorage) sessionStorage.removeItem(USER_ROLE_KEY)
    else localStorage.removeItem(USER_ROLE_KEY)
  } else {
    st.removeItem(USER_ROLE_KEY)
  }
}

function clearAuthStorage() {
  localStorage.removeItem(STORAGE_FLAG_KEY)
  localStorage.removeItem(USER_ROLE_KEY)
  sessionStorage.removeItem(USER_ROLE_KEY)
  clearAccessToken()
}

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // 首次加载：如果 token 过期 -> 尝试刷新；若成功 -> 取用户；失败 -> 清理并停留在未登录态
  useEffect(() => {
    ;(async () => {
      const token = getAccessToken()
      if (!token) {
        // 无 token：清掉残留角色信息
        localStorage.removeItem(USER_ROLE_KEY)
        sessionStorage.removeItem(USER_ROLE_KEY)
        setLoading(false)
        return
      }

      const expMs = decodeExp(token)
      const isExpired = expMs !== null && Date.now() >= expMs

      try {
        if (isExpired) {
          // 过期：尝试用刷新令牌换新
          const refreshed = await auth.refresh()
          if ('success' in refreshed && refreshed.success && (refreshed.data as any)?.token) {
            setAccessToken((refreshed.data as any).token as string)
          } else {
            clearAuthStorage()
            setUser(null)
            setLoading(false)
            return
          }
        }

        // 尝试读取当前用户
        const me = await users.getCurrentUser()
        if ('success' in me && me.success) {
          const userData = me.data as any
          // 同步/补齐角色
          if (!userData.role) {
            const storedRole = localStorage.getItem(USER_ROLE_KEY) || sessionStorage.getItem(USER_ROLE_KEY)
            if (storedRole) userData.role = storedRole
          }
          if (userData.role) setRole(userData.role)
          setUser(userData)
        } else {
          // 如果失败再次尝试刷新一次（可能边界时序）
          const refreshed = await auth.refresh()
          if ('success' in refreshed && refreshed.success && (refreshed.data as any)?.token) {
            setAccessToken((refreshed.data as any).token as string)
            const me2 = await users.getCurrentUser()
            if ('success' in me2 && me2.success) {
              const userData = me2.data as any
              if (!userData.role) {
                const storedRole = localStorage.getItem(USER_ROLE_KEY) || sessionStorage.getItem(USER_ROLE_KEY)
                if (storedRole) userData.role = storedRole
              }
              if (userData.role) setRole(userData.role)
              setUser(userData)
            } else {
              clearAuthStorage()
              setUser(null)
            }
          } else {
            clearAuthStorage()
            setUser(null)
          }
        }
      } catch {
        clearAuthStorage()
        setUser(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const signIn = async (email: string, password: string, rememberMe: boolean = false) => {
    const result = await auth.login(email, password)
    if ('error' in result) throw new Error(result.error || '登录失败')

    const { token, user: userData } = result.data as { token: string; user: User }

    // 保存 storage 偏好
    localStorage.setItem(STORAGE_FLAG_KEY, rememberMe ? 'local' : 'session')

    // 保存访问令牌
    setAccessToken(token)

    // 角色
    if (userData.role) setRole(userData.role)

    setUser(userData)
  }

  const signUp = async (email: string, password: string, username: string, role: string) => {
    const result = await auth.register({ email, password, username, role })
    if ('error' in result) throw new Error(result.error || '注册失败')

    const { token, user: userData } = result.data as { token: string; user: User }
    // 默认注册后采用 local 保存
    localStorage.setItem(STORAGE_FLAG_KEY, 'local')
    setAccessToken(token)
    setRole(userData.role || role)
    setUser(userData)
  }

  const signOut = async () => {
    try {
      await auth.logout() // 会尝试调后端 /auth/logout（如不存在也不会报错）
    } catch {}
    clearAuthStorage()
    setUser(null)
  }

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
