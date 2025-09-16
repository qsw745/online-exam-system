// apps/web/src/modules/auth/hooks/useLogin.ts
import { adminSettingsApi } from '@/shared/api/endpoints/admin-settings'
import { auth as authApi } from '@/shared/api/endpoints/auth'
import { useAuth } from '@/shared/contexts/AuthContext'
import { decryptLocal, encryptLocal, tryEncryptRemote } from '@/shared/utils/cryptoLocal'
import { App } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const STORAGE_FLAG_KEY = 'auth_storage' // 'session' | '7d'
const REMEMBER_PACK_KEY = 'remember_pack_v1' // 记住我（本地加密）
const FAILED_COUNT_KEY = 'login_failed_count' // 本地累计失败
const LOCK_UNTIL_KEY = 'login_lock_until_ms' // 锁定到期时间戳
const SERVER_CAPTCHA_FLAG = 'login_need_captcha' // ⭐ 新增：后端强制需要验证码（持久化）

const CODE_NEED_CAPTCHA = 'NEED_CAPTCHA'
const CODE_BAD_CAPTCHA = 'BAD_CAPTCHA'
const CODE_BAD_CREDS = 'BAD_CREDENTIALS'
const HTTP_UNAUTH = 401

type Settings = {
  enableCaptcha: boolean
  captchaAfterFailedAttempts: number
  lockAfterFailedAttempts: number
  lockMinutes: number
}

function normalizeSettings(raw: any): Settings {
  const enableCaptcha = !!(
    raw?.enableCaptcha ??
    raw?.enable_captcha ??
    raw?.captchaEnabled ??
    raw?.captcha_enabled ??
    false
  )
  const captchaAfterFailedAttempts = Number(
    raw?.captchaAfterFailedAttempts ??
      raw?.captchaAfterFailed ??
      raw?.captcha_after_failed ??
      raw?.captchaThreshold ??
      3
  )
  const lockAfter =
    Number(raw?.lockAfterFailedAttempts ?? raw?.lockAfterFailed ?? raw?.lock_after_failed) ||
    Math.max((Number.isFinite(captchaAfterFailedAttempts) ? captchaAfterFailedAttempts : 3) + 2, 5)
  const lockMinutes = Number(raw?.lockMinutes ?? raw?.lock_minutes ?? 5)

  return {
    enableCaptcha,
    captchaAfterFailedAttempts: Number.isFinite(captchaAfterFailedAttempts) ? captchaAfterFailedAttempts : 3,
    lockAfterFailedAttempts: Number.isFinite(lockAfter) ? lockAfter : 6,
    lockMinutes: Number.isFinite(lockMinutes) ? lockMinutes : 5,
  }
}

function parseLoginError(err: any): { msg: string; code?: string; status?: number } {
  const code = err?.response?.data?.code
  const status = err?.response?.status
  const backend = err?.response?.data?.error || err?.response?.data?.message
  if (backend) return { msg: String(backend), code, status }
  if (err?.message) return { msg: err.message, code, status }
  if (status) {
    switch (status) {
      case 401:
        return { msg: '邮箱或密码错误，请检查后重试', code, status }
      case 403:
        return { msg: '账号已被禁用，请联系管理员', code, status }
      case 429:
        return { msg: '请求过于频繁，请稍后再试', code, status }
      default:
        return { msg: '未知错误', code, status }
    }
  }
  if (err?.request) return { msg: '服务器无响应，请稍后重试', code, status }
  return { msg: '网络连接错误，请检查网络后重试', code, status }
}

function svgToDataUrl(svg: string) {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg.replace(/\r?\n/g, ''))
}

// ⭐ 文案型判断：把 200 + "用户名/邮箱/账号或密码错误" 视为密码错误
const looksLikeBadCreds = (msg?: string) =>
  !!msg && /(用户名|邮箱|账号).*(密码).*(错误)|密码错误|credentials/i.test(msg)

// ⭐ 文案型判断：把 200 + "请先完成验证码 / 验证码错误/过期" 视为需要验证码
const looksLikeNeedCaptcha = (msg?: string) => !!msg && /(请先完成验证码|验证码(错误|过期)|captcha)/i.test(msg || '')

export function useLogin() {
  const { message } = App.useApp()
  const { signIn } = useAuth()

  // 表单
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [keep7Days, setKeep7Days] = useState(false)
  const [loading, setLoading] = useState(false)

  // 设置
  const [settings, setSettings] = useState<Settings | null>(null)
  const captchaThreshold = useMemo(
    () => Number(settings?.captchaAfterFailedAttempts ?? 3),
    [settings?.captchaAfterFailedAttempts]
  )
  const lockAfter = useMemo(() => Number(settings?.lockAfterFailedAttempts ?? 6), [settings?.lockAfterFailedAttempts])
  const lockMinutes = useMemo(() => Number(settings?.lockMinutes ?? 5), [settings?.lockMinutes])

  // 失败计数
  const [failedCount, setFailedCount] = useState(0)

  // 验证码（两种来源）
  const [captchaByServer, setCaptchaByServer] = useState(false)
  const [captchaByThreshold, setCaptchaByThreshold] = useState(false)
  const captchaRequired = captchaByServer || captchaByThreshold

  const [captcha, setCaptcha] = useState('')
  const [captchaId, setCaptchaId] = useState<string | null>(null)
  const [captchaImgUrl, setCaptchaImgUrl] = useState<string | undefined>(undefined)

  // 锁定
  const [lockUntil, setLockUntil] = useState<number | null>(null)
  const [nowTick, setNowTick] = useState<number>(Date.now())
  const lockTimerRef = useRef<number | null>(null)
  const isLocked = useMemo(() => (lockUntil ? Date.now() < lockUntil : false), [lockUntil])
  const lockRemainingSec = useMemo(
    () => (lockUntil ? Math.max(0, Math.ceil((lockUntil - nowTick) / 1000)) : 0),
    [lockUntil, nowTick]
  )

  // 加载系统设置
  useEffect(() => {
    ;(async () => {
      try {
        const raw = await adminSettingsApi.getPublic()
        setSettings(normalizeSettings(raw))
      } catch {
        setSettings({ enableCaptcha: true, captchaAfterFailedAttempts: 3, lockAfterFailedAttempts: 6, lockMinutes: 5 })
      }
    })()
  }, [])

  // 初始化本地状态
  useEffect(() => {
    ;(async () => {
      const pack = localStorage.getItem(REMEMBER_PACK_KEY)
      const json = await decryptLocal(pack)
      if (json) {
        try {
          const { email: e, password: p } = JSON.parse(json)
          if (e) setEmail(e)
          if (p) setPassword(p)
          setRememberMe(true)
        } catch {
          setRememberMe(false)
          setPassword('')
        }
      } else {
        setRememberMe(false)
        setPassword('')
      }

      const n = Number(localStorage.getItem(FAILED_COUNT_KEY) || 0)
      if (Number.isFinite(n) && n > 0) setFailedCount(n)

      const flag = localStorage.getItem(STORAGE_FLAG_KEY)
      setKeep7Days(flag === '7d')

      const lu = Number(localStorage.getItem(LOCK_UNTIL_KEY) || 0)
      if (Number.isFinite(lu) && lu > Date.now()) setLockUntil(lu)
      else localStorage.removeItem(LOCK_UNTIL_KEY)

      // ⭐ 读取“服务器强制需要验证码”的持久化标记
      setCaptchaByServer(localStorage.getItem(SERVER_CAPTCHA_FLAG) === '1')
    })()
  }, [])

  // 切页退出登录：刷新 UI
  useEffect(() => {
    const onLogout = async () => {
      const pack = localStorage.getItem(REMEMBER_PACK_KEY)
      const json = await decryptLocal(pack)
      if (json) {
        try {
          const { email: e, password: p } = JSON.parse(json)
          setRememberMe(true)
          setEmail(e || '')
          setPassword(p || '')
        } catch {
          setRememberMe(false)
          setPassword('')
        }
      } else {
        setRememberMe(false)
        setPassword('')
      }
      const flag = localStorage.getItem(STORAGE_FLAG_KEY)
      setKeep7Days(flag === '7d')
    }
    window.addEventListener('auth:logout' as any, onLogout)
    return () => window.removeEventListener('auth:logout' as any, onLogout)
  }, [])

  // 锁定倒计时
  useEffect(() => {
    if (!isLocked) {
      if (lockTimerRef.current) {
        window.clearInterval(lockTimerRef.current)
        lockTimerRef.current = null
      }
      return
    }
    if (!lockTimerRef.current) lockTimerRef.current = window.setInterval(() => setNowTick(Date.now()), 1000)
    return () => {
      if (lockTimerRef.current) {
        window.clearInterval(lockTimerRef.current)
        lockTimerRef.current = null
      }
    }
  }, [isLocked])

  // 锁定到期清理
  useEffect(() => {
    if (!lockUntil) return
    if (Date.now() >= lockUntil) {
      setLockUntil(null)
      localStorage.removeItem(LOCK_UNTIL_KEY)
    }
  }, [nowTick, lockUntil])

  // 加载验证码
  const loadCaptcha = useCallback(async () => {
    try {
      const resp = await authApi.captchaNew()
      if ((resp as any)?.success === false && (resp as any)?.error) {
        App.useApp().message.error(String((resp as any).error))
      }
      const raw = resp as any
      const d = raw?.data ?? raw
      const id = d?.id ?? d?.data?.id
      const svg = d?.svg ?? d?.data?.svg
      if (id && svg) {
        setCaptchaId(id)
        setCaptchaImgUrl(svgToDataUrl(svg))
      } else {
        setCaptchaId(null)
        setCaptchaImgUrl(undefined)
      }
    } catch (e) {
      const { msg } = parseLoginError(e)
      App.useApp().message.error(msg || '验证码加载失败')
      setCaptchaId(null)
      setCaptchaImgUrl(undefined)
    }
  }, [])

  // ⭐ 页面初始化后，只要满足任一条件就立刻显示验证码并拉取图片：
  // - 后端强制标记为 true（持久化）
  // - 本地失败次数达到阈值
  useEffect(() => {
    if (!settings?.enableCaptcha) return
    const needByThreshold = failedCount >= captchaThreshold
    setCaptchaByThreshold(needByThreshold)
    if (captchaByServer || needByThreshold) {
      // 只要当前没有有效 captchaId 就拉一次
      if (!captchaId) loadCaptcha()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.enableCaptcha, failedCount, captchaThreshold, captchaByServer]) // 故意不把 captchaId 放依赖，避免死循环

  // 刷新验证码
  const refreshCaptcha = useCallback(() => {
    setCaptcha('')
    loadCaptcha()
  }, [loadCaptcha])

  // 记住我持久化
  const saveRemember = useCallback(
    async (em: string, pwd: string) => {
      if (!rememberMe) {
        localStorage.removeItem(REMEMBER_PACK_KEY)
        return
      }
      const enc = await encryptLocal(JSON.stringify({ email: em, password: pwd }))
      localStorage.setItem(REMEMBER_PACK_KEY, enc)
    },
    [rememberMe]
  )

  // 进入锁定
  const enterLock = useCallback(() => {
    const until = Date.now() + lockMinutes * 60 * 1000
    setLockUntil(until)
    localStorage.setItem(LOCK_UNTIL_KEY, String(until))
    if (settings?.enableCaptcha) refreshCaptcha()
  }, [lockMinutes, settings?.enableCaptcha, refreshCaptcha])

  // 提交
  const submit = useCallback(async () => {
    // 先就地计算剩余秒数
    if (lockUntil) {
      const remainingNow = Math.ceil((lockUntil - Date.now()) / 1000)
      if (remainingNow > 0) {
        message.error(`登录已临时锁定，请 ${remainingNow} 秒后再试`)
        return
      }
      setLockUntil(null)
      localStorage.removeItem(LOCK_UNTIL_KEY)
    }

    if (!email || !password) {
      message.error('请填写邮箱和密码')
      return
    }
    if (captchaRequired) {
      if (!captcha) {
        message.error('请输入验证码')
        return
      }
      if (!captchaId) {
        message.error('验证码已失效，请点击刷新')
        await loadCaptcha()
        return
      }
    }

    setLoading(true)
    try {
      localStorage.setItem(STORAGE_FLAG_KEY, keep7Days ? '7d' : 'session')

      const remote = await tryEncryptRemote({ email, password, captcha, captchaId: captchaId || undefined })
      const extra = {
        captcha: captchaRequired ? captcha : undefined,
        captchaId: captchaRequired ? captchaId || undefined : undefined,
        ...(remote ?? {}),
      }

      await signIn(email, password, keep7Days, extra)

      // 登录成功：清理状态
      localStorage.removeItem(FAILED_COUNT_KEY)
      localStorage.removeItem(LOCK_UNTIL_KEY)
      localStorage.removeItem(SERVER_CAPTCHA_FLAG) // ⭐ 清后端强制标记
      setFailedCount(0)
      setLockUntil(null)
      setCaptcha('')
      setCaptchaId(null)
      setCaptchaImgUrl(undefined)
      setCaptchaByServer(false)
      setCaptchaByThreshold(false)
      message.success('登录成功')
    } catch (err: any) {
      const { msg, code, status } = parseLoginError(err)
      const isNeedCaptcha = code === CODE_NEED_CAPTCHA || looksLikeNeedCaptcha(msg)
      const isBadCaptcha = code === CODE_BAD_CAPTCHA
      const isBadCreds = code === CODE_BAD_CREDS || status === HTTP_UNAUTH || looksLikeBadCreds(msg)

      // ① 验证码填写错误：刷新验证码
      if (isBadCaptcha) {
        setCaptcha('')
        await loadCaptcha()
        message.error(msg || '验证码错误，请重试')
        setLoading(false)
        return
      }

      // ② 后端强制需要验证码
      if (isNeedCaptcha) {
        setCaptchaByServer(true)
        localStorage.setItem(SERVER_CAPTCHA_FLAG, '1') // ⭐ 持久化，刷新后也显示
        setCaptcha('')
        await loadCaptcha()
        message.error(msg || '请先完成验证码验证')
        setLoading(false)
        return
      }

      // ③ 用户名/密码错误 → 计数、可能触发锁定/验证码
      if (isBadCreds) {
        // 如果当前已需要验证码，每次失败后也刷新一次，避免旧 captcha 继续使用
        if (captchaRequired) {
          setCaptcha('')
          await loadCaptcha()
        }

        const next = (Number(localStorage.getItem(FAILED_COUNT_KEY) || 0) || 0) + 1
        localStorage.setItem(FAILED_COUNT_KEY, String(next))
        setFailedCount(next)

        // 达到阈值：立即显示验证码
        if (settings?.enableCaptcha && next >= captchaThreshold) {
          setCaptchaByThreshold(true)
          if (!captchaRequired) {
            setCaptcha('')
            await loadCaptcha()
          }
        }

        // 锁定判断（支持设置里没有 lockAfter 字段的情况）
        if (next >= lockAfter) {
          enterLock()
          message.error(`密码连续错误次数过多，登录已锁定 ${lockMinutes} 分钟`)
        } else {
          message.error(msg || '邮箱或密码错误，请检查后重试')
        }
      } else {
        // ④ 其他错误：如果当前需要验证码，也顺刷新一次
        if (captchaRequired) {
          setCaptcha('')
          await loadCaptcha()
        }
        message.error(msg || '登录失败')
      }
    } finally {
      setLoading(false)
    }
  }, [
    email,
    password,
    keep7Days,
    captchaRequired,
    captcha,
    captchaId,
    lockUntil,
    message,
    signIn,
    loadCaptcha,
    refreshCaptcha,
    lockAfter,
    lockMinutes,
    enterLock,
    settings?.enableCaptcha,
    captchaThreshold,
  ])

  return {
    email,
    setEmail,
    password,
    setPassword,
    rememberMe,
    setRememberMe,
    keep7Days,
    setKeep7Days,
    loading,
    submit,
    quickLogin: (em: string, pw = 'demo123456') => {
      setEmail(em)
      setPassword(pw)
    },

    // 验证码
    captchaRequired,
    captcha,
    setCaptcha,
    captchaImgUrl,
    refreshCaptcha,

    // 锁定
    isLocked,
    lockRemainingSec,
  }
}
