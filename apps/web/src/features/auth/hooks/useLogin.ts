/* eslint-disable @typescript-eslint/no-explicit-any */
import { adminSettingsApi } from '@/shared/api/endpoints/admin-settings'
import { auth as authApi } from '@/shared/api/endpoints/auth'
import { useAuth } from '@/shared/contexts/AuthContext'
import { decryptLocal, encryptLocal, tryEncryptRemote } from '@/shared/utils/cryptoLocal'
import { App } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const STORAGE_FLAG_KEY = 'auth_storage'
const REMEMBER_PACK_KEY = 'remember_pack_v1'
const REMEMBER_ME_FLAG = 'remember_me_flag'
const LAST_EMAIL_KEY = 'last_login_email'

// 历史兼容键
const FAILED_COUNT_KEY = 'login_failed_count'
const LOCK_UNTIL_KEY = 'login_lock_until_ms'
const SERVER_CAPTCHA_FLAG = 'login_need_captcha'

// 业务码
const CODE_NEED_CAPTCHA = 'NEED_CAPTCHA'
const CODE_BAD_CAPTCHA = 'BAD_CAPTCHA'
const CODE_BAD_CREDS = 'BAD_CREDENTIALS'
const CODE_LOCKED = 'AUTH_LOCKED'
const CODE_LOCKED_LEGACY = 'LOCKED'
const HTTP_UNAUTH = 401

const keyFor = (b: string, em: string) => `${b}:${(em || '').trim().toLowerCase()}`
const failedKey = (em: string) => keyFor('login_failed_count', em)
const lockKey = (em: string) => keyFor('login_lock_until_ms', em)
const lockTryKey = (em: string) => keyFor('login_locked_next_try_at', em) // 锁定期“下次可重试时间”（10s 冷却）

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
    Math.max((Number.isFinite(captchaAfterFailedAttempts) ? captchaAfterFailedAttempts : 3) + 2, 6)
  const lockMinutes = Number(raw?.lockMinutes ?? raw?.lock_minutes ?? 5)
  return {
    enableCaptcha,
    captchaAfterFailedAttempts: Number.isFinite(captchaAfterFailedAttempts) ? captchaAfterFailedAttempts : 3,
    lockAfterFailedAttempts: Number.isFinite(lockAfter) ? lockAfter : 6,
    lockMinutes: Number.isFinite(lockMinutes) ? lockMinutes : 5,
  }
}

function parseLoginError(err: any): {
  msg: string
  code?: string
  status?: number
  data?: any
  retryAfterSec?: number
} {
  const res = err?.response
  const code = res?.data?.code
  const status = res?.status
  const backendMsg = res?.data?.message
  const data = res?.data?.data
  const rh = res?.headers || {}
  const retryAfter = rh['retry-after'] ? Number(rh['retry-after']) : undefined
  const msg = backendMsg || err?.message || '错误'
  return { msg, code, status, data, retryAfterSec: Number.isFinite(retryAfter) ? Number(retryAfter) : undefined }
}

function svgToDataUrl(svg: string) {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg.replace(/\r?\n/g, ''))
}
const looksLikeBadCreds = (msg?: string) =>
  !!msg && /(用户名|邮箱|账号).*(密码).*(错误)|密码错误|credentials/i.test(msg || '')
const looksLikeNeedCaptcha = (msg?: string) => !!msg && /(请先完成验证码|验证码(错误|过期)|captcha)/i.test(msg || '')

function toMMSS(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec))
  const m = Math.floor(s / 60)
    .toString()
    .padStart(2, '0')
  const r = (s % 60).toString().padStart(2, '0')
  return `${m}:${r}`
}

export function useLogin() {
  const { message } = App.useApp()
  const { signIn } = useAuth()

  // 表单
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [keep7Days, setKeep7Days] = useState(false)
  const [loading, setLoading] = useState(false)
  const [prefsReady, setPrefsReady] = useState(false)

  // 设置
  const [settings, setSettings] = useState<Settings | null>(null)
  const captchaThreshold = useMemo(
    () => Number(settings?.captchaAfterFailedAttempts ?? 3),
    [settings?.captchaAfterFailedAttempts]
  )
  const lockAfter = useMemo(() => Number(settings?.lockAfterFailedAttempts ?? 6), [settings?.lockAfterFailedAttempts])
  const lockMinutes = useMemo(() => Number(settings?.lockMinutes ?? 5), [settings?.lockMinutes])

  // 验证码
  const [captchaByServer, setCaptchaByServer] = useState(false)
  const [captchaByThreshold, setCaptchaByThreshold] = useState(false)
  const captchaRequired = captchaByServer || captchaByThreshold
  const [captcha, setCaptcha] = useState('')
  const [captchaId, setCaptchaId] = useState<string | null>(null)
  const [captchaImgUrl, setCaptchaImgUrl] = useState<string | undefined>(undefined)

  // —— 锁定 —— //
  const [lockUntil, setLockUntil] = useState<number | null>(null) // 账户解锁时间（毫秒）
  const [lockedNextTryAt, setLockedNextTryAt] = useState<number>(0) // 下次可重试时间（10s 冷却）
  const [nowTick, setNowTick] = useState<number>(Date.now())
  const tickRef = useRef<number | null>(null)

  const isLocked = useMemo(() => !!lockUntil && nowTick < lockUntil, [lockUntil, nowTick])
  const lockRemainingSec = useMemo(
    () => (lockUntil ? Math.max(0, Math.ceil((lockUntil - nowTick) / 1000)) : 0),
    [lockUntil, nowTick]
  )
  const lockCountdownText = useMemo(() => toMMSS(lockRemainingSec), [lockRemainingSec])

  const lockTryRemainSec = useMemo(
    () => (isLocked ? Math.max(0, Math.ceil((lockedNextTryAt - nowTick) / 1000)) : 0),
    [isLocked, lockedNextTryAt, nowTick]
  )
  const lockRetryCountdownText = useMemo(() => `${lockTryRemainSec}s`, [lockTryRemainSec])

  // ✅ 只禁用“提交按钮”，输入框不因锁定禁用（仅在 loading 时禁）
  const submitDisabled = useMemo(
    () => loading || (isLocked && lockTryRemainSec > 0),
    [loading, isLocked, lockTryRemainSec]
  )
  const inputsDisabled = useMemo(() => loading, [loading])

  // —— 初始化 —— //
  useEffect(() => {
    if (email) {
      try {
        localStorage.setItem(LAST_EMAIL_KEY, email)
      } catch {}
    }
  }, [email])

  useEffect(() => {
    ;(async () => {
      try {
        setSettings(normalizeSettings(await adminSettingsApi.getPublic()))
      } catch {
        setSettings({ enableCaptcha: true, captchaAfterFailedAttempts: 3, lockAfterFailedAttempts: 6, lockMinutes: 5 })
      }
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      const rememberFlag = localStorage.getItem(REMEMBER_ME_FLAG) === '1'
      setRememberMe(rememberFlag)
      const lastEmail = localStorage.getItem(LAST_EMAIL_KEY) || ''
      if (rememberFlag) {
        const pack = localStorage.getItem(REMEMBER_PACK_KEY)
        const json = await decryptLocal(pack)
        if (json) {
          try {
            const { email: e, password: p } = JSON.parse(json)
            setEmail(typeof e === 'string' ? e : lastEmail)
            setPassword(typeof p === 'string' ? p : '')
          } catch {
            setEmail(lastEmail)
            setPassword('')
          }
        } else {
          setEmail(lastEmail)
          setPassword('')
        }
      } else {
        setEmail(lastEmail)
        setPassword('')
      }
      const flag = localStorage.getItem(STORAGE_FLAG_KEY)
      setKeep7Days(flag === '7d')
      setCaptchaByServer(localStorage.getItem(SERVER_CAPTCHA_FLAG) === '1')
      setPrefsReady(true)
    })()
  }, [])

  // 恢复锁定 + 10s 重试时间（基于当前 email）
  useEffect(() => {
    if (!email) return
    const lu = Number(localStorage.getItem(lockKey(email)) || 0)
    setLockUntil(Number.isFinite(lu) && lu > Date.now() ? lu : null)
    const tu = Number(localStorage.getItem(lockTryKey(email)) || 0)
    setLockedNextTryAt(Number.isFinite(tu) ? tu : 0)
  }, [email])

  // 全局 1s tick
  useEffect(() => {
    if (!tickRef.current) tickRef.current = window.setInterval(() => setNowTick(Date.now()), 1000)
    return () => {
      if (tickRef.current) {
        window.clearInterval(tickRef.current)
        tickRef.current = null
      }
    }
  }, [])

  // 锁定过期清理
  useEffect(() => {
    if (!lockUntil) return
    if (Date.now() >= lockUntil) {
      setLockUntil(null)
      try {
        localStorage.removeItem(lockKey(email))
      } catch {}
    }
  }, [nowTick, lockUntil, email])

  // 验证码
  const loadCaptcha = useCallback(async () => {
    try {
      const resp = await authApi.captchaNew()
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
  const refreshCaptcha = useCallback(() => {
    setCaptcha('')
    loadCaptcha()
  }, [loadCaptcha])

  useEffect(() => {
    if (!settings?.enableCaptcha) return
    const needByThreshold = (Number(localStorage.getItem(failedKey(email)) || 0) || 0) >= (captchaThreshold || 3)
    setCaptchaByThreshold(needByThreshold)
    if ((captchaByServer || needByThreshold) && !captchaId) loadCaptcha()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.enableCaptcha, captchaByServer, captchaThreshold, email])

  // 记住我
  const saveRemember = useCallback(
    async (em: string, pwd: string) => {
      if (!rememberMe) return
      const enc = await encryptLocal(JSON.stringify({ email: em, password: pwd }))
      localStorage.setItem(REMEMBER_PACK_KEY, enc)
      try {
        localStorage.setItem(LAST_EMAIL_KEY, em || '')
      } catch {}
    },
    [rememberMe]
  )

  useEffect(() => {
    if (!prefsReady) return
    ;(async () => {
      if (rememberMe) {
        localStorage.setItem(REMEMBER_ME_FLAG, '1')
        await saveRemember(email, password)
      } else {
        localStorage.setItem(REMEMBER_ME_FLAG, '0')
        localStorage.removeItem(REMEMBER_PACK_KEY)
        try {
          localStorage.setItem(LAST_EMAIL_KEY, email || '')
        } catch {}
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rememberMe, prefsReady])

  useEffect(() => {
    if (!prefsReady || !rememberMe) return
    const tid = window.setTimeout(() => {
      saveRemember(email, password)
    }, 300)
    return () => window.clearTimeout(tid)
  }, [email, password, rememberMe, saveRemember, prefsReady])

  // —— 提交 —— //
  const submit = useCallback(async () => {
    // 锁定 + 10s 冷却未到：禁止提交
    if (isLocked && lockTryRemainSec > 0) return

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
      try {
        localStorage.setItem(LAST_EMAIL_KEY, email || '')
      } catch {}

      const remote = await tryEncryptRemote({ email, password, captcha, captchaId: captchaId || undefined })
      const extra = {
        captcha: captchaRequired ? captcha : undefined,
        captchaId: captchaRequired ? captchaId || undefined : undefined,
        ...(remote ?? {}),
        keep7Days,
      }
      await signIn(email, password, keep7Days, extra)

      // 成功：清理锁定/失败本地状态
      ;[
        failedKey(email),
        lockKey(email),
        lockTryKey(email),
        FAILED_COUNT_KEY,
        LOCK_UNTIL_KEY,
        SERVER_CAPTCHA_FLAG,
      ].forEach(k => {
        try {
          localStorage.removeItem(k)
        } catch {}
      })
      setLockUntil(null)
      setLockedNextTryAt(0)
      setCaptcha('')
      setCaptchaId(null)
      setCaptchaImgUrl(undefined)
      setCaptchaByServer(false)
      setCaptchaByThreshold(false)
      message.success('登录成功')
    } catch (err: any) {
      const { msg, code, status, data, retryAfterSec } = parseLoginError(err)
      const serverSaysLocked = code === CODE_LOCKED || code === CODE_LOCKED_LEGACY || status === 423

      if (serverSaysLocked) {
        // —— 进入/维持锁定：以后端为准 —— //
        const untilMs: number | undefined = data?.unlockAt
        const remainingSec: number | undefined = data?.remainingSec
        const finalUntil =
          typeof untilMs === 'number' && untilMs > Date.now()
            ? untilMs
            : typeof remainingSec === 'number' && remainingSec > 0
            ? Date.now() + remainingSec * 1000
            : Date.now() + (retryAfterSec ? retryAfterSec * 1000 : 60_000)

        setLockUntil(finalUntil)
        try {
          localStorage.setItem(lockKey(email), String(finalUntil))
        } catch {}

        // 10s 再试点
        const nextTry = Date.now() + 10_000
        setLockedNextTryAt(nextTry)
        try {
          localStorage.setItem(lockTryKey(email), String(nextTry))
        } catch {}

        const secs = Math.max(1, Math.ceil((finalUntil - Date.now()) / 1000))
        message.error(`账号已临时锁定 ${secs} 秒`)
        if (captchaRequired) {
          setCaptcha('')
          await loadCaptcha()
        }
        return
      }

      const isNeedCaptcha = code === CODE_NEED_CAPTCHA || looksLikeNeedCaptcha(msg)
      const isBadCaptcha = code === CODE_BAD_CAPTCHA
      const isBadCreds = code === CODE_BAD_CREDS || status === HTTP_UNAUTH || looksLikeBadCreds(msg)

      if (isBadCaptcha) {
        setCaptcha('')
        await loadCaptcha()
        message.error(msg || '验证码错误，请重试')
        return
      }
      if (isNeedCaptcha) {
        setCaptchaByServer(true)
        try {
          localStorage.setItem(SERVER_CAPTCHA_FLAG, '1')
        } catch {}
        setCaptcha('')
        await loadCaptcha()
        message.error(msg || '请先完成验证码验证')
        return
      }
      if (isBadCreds) {
        if (captchaRequired) {
          setCaptcha('')
          await loadCaptcha()
        }

        const fk = failedKey(email)
        const cur = Number(localStorage.getItem(fk) || 0) || 0
        const next = cur + 1
        try {
          localStorage.setItem(fk, String(next))
        } catch {}

        // 触发验证码阈值
        if (settings?.enableCaptcha && next >= captchaThreshold) {
          setCaptchaByThreshold(true)
          if (!captchaRequired) {
            setCaptcha('')
            await loadCaptcha()
          }
        }

        // 达到锁定阈值：本地立即进入锁定（避免等待服务端下一次判定）
        if (next >= lockAfter) {
          const until = Date.now() + lockMinutes * 60_000
          setLockUntil(until)
          try {
            localStorage.setItem(lockKey(email), String(until))
          } catch {}
          const nextTry = Date.now() + 10_000
          setLockedNextTryAt(nextTry)
          try {
            localStorage.setItem(lockTryKey(email), String(nextTry))
          } catch {}
          const secs = Math.max(1, Math.ceil((until - Date.now()) / 1000))
          message.error(`账号已临时锁定 ${secs} 秒`)
        } else {
          // 普通输错：不禁用按钮
          message.error(msg || '用户名或密码错误')
        }
        return
      }

      // 其它错误
      if (captchaRequired) {
        setCaptcha('')
        await loadCaptcha()
      }
      message.error(msg || '登录失败')
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
    isLocked,
    lockTryRemainSec,
    message,
    signIn,
    loadCaptcha,
    captchaThreshold,
    lockAfter,
    lockMinutes,
    settings?.enableCaptcha,
  ])

  // 开发期调试（可删）
  // @ts-expect-error
  if (typeof window !== 'undefined')
    (window as any).__loginDebug = { isLocked, lockUntil, lockRemainingSec, lockedNextTryAt, lockTryRemainSec }

  return {
    // 表单
    email,
    setEmail,
    password,
    setPassword,
    rememberMe,
    setRememberMe,
    keep7Days,
    setKeep7Days,
    loading,

    // 提交 & 控制
    submit,
    submitDisabled,
    inputsDisabled,

    // 验证码
    captchaRequired,
    captcha,
    setCaptcha,
    captchaImgUrl,
    refreshCaptcha,

    // 锁定信息
    isLocked,
    lockRemainingSec,
    lockCountdownText,
    lockTryRemainSec,
    lockRetryCountdownText,
    lockUiHint: isLocked ? `账号暂时锁定，剩余 ${lockCountdownText}` : '',

    // Demo
    quickLogin: (em: string, pw = 'demo123456') => {
      setEmail(em)
      setPassword(pw)
    },
  }
}
