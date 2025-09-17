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

const FAILED_COUNT_KEY = 'login_failed_count'
const LOCK_UNTIL_KEY = 'login_lock_until_ms'
const SERVER_CAPTCHA_FLAG = 'login_need_captcha'

const CODE_NEED_CAPTCHA = 'NEED_CAPTCHA'
const CODE_BAD_CAPTCHA = 'BAD_CAPTCHA'
const CODE_BAD_CREDS = 'BAD_CREDENTIALS'
const CODE_LOCKED = 'AUTH_LOCKED'
const CODE_LOCKED_LEGACY = 'LOCKED'
const HTTP_UNAUTH = 401

const keyFor = (b: string, em: string) => `${b}:${(em || '').trim().toLowerCase()}`
const failedKey = (em: string) => keyFor('login_failed_count', em)
const lockKey = (em: string) => keyFor('login_lock_until_ms', em)

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
  !!msg && /(用户名|邮箱|账号).*(密码).*(错误)|密码错误|credentials/i.test(msg)
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
  const { signIn } = useAuth() // ✅ 仅此一处

  // —— 本地“请求节流门”：防疯狂点击 —— //
  const [nextAllowSubmitAt, setNextAllowSubmitAt] = useState<number>(0)
  const touchSubmitCooldown = useCallback((sec = 1) => setNextAllowSubmitAt(Date.now() + Math.max(1, sec) * 1000), [])

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

  // 失败/验证码
  const [failedCount, setFailedCount] = useState(0)
  const [captchaByServer, setCaptchaByServer] = useState(false)
  const [captchaByThreshold, setCaptchaByThreshold] = useState(false)
  const captchaRequired = captchaByServer || captchaByThreshold
  const [captcha, setCaptcha] = useState('')
  const [captchaId, setCaptchaId] = useState<string | null>(null)
  const [captchaImgUrl, setCaptchaImgUrl] = useState<string | undefined>(undefined)

  // 锁定（按钮禁用 + 倒计时）
  const [lockUntil, setLockUntil] = useState<number | null>(null)
  const [nowTick, setNowTick] = useState<number>(Date.now())
  const lockTimerRef = useRef<number | null>(null)
  const isLocked = useMemo(() => !!lockUntil && nowTick < lockUntil, [lockUntil, nowTick])
  const lockRemainingSec = useMemo(
    () => (lockUntil ? Math.max(0, Math.ceil((lockUntil - nowTick) / 1000)) : 0),
    [lockUntil, nowTick]
  )
  const lockCountdownText = useMemo(() => toMMSS(lockRemainingSec), [lockRemainingSec])
  const lockUiHint = useMemo(
    () => (isLocked ? `账号暂时锁定，剩余 ${lockCountdownText}` : ''),
    [isLocked, lockCountdownText]
  )

  const submitDisabled = useMemo(
    () => loading || isLocked || Date.now() < nextAllowSubmitAt,
    [loading, isLocked, nextAllowSubmitAt]
  )
  const inputsDisabled = useMemo(() => loading || isLocked, [loading, isLocked])

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

  // 恢复锁定
  useEffect(() => {
    if (!email) return
    const lk = lockKey(email)
    const lu = Number(localStorage.getItem(lk) || 0)
    setLockUntil(Number.isFinite(lu) && lu > Date.now() ? lu : null)
  }, [email])

  // 启停倒计时
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

  // 收到 lockUntil 刷新一次（立即显示 mm:ss）
  useEffect(() => {
    if (lockUntil) setNowTick(Date.now())
  }, [lockUntil])

  // 到期清理
  useEffect(() => {
    if (!lockUntil) return
    if (Date.now() >= lockUntil) {
      const lk = lockKey(email)
      setLockUntil(null)
      localStorage.removeItem(lk)
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
    // 冷却中不提交
    if (Date.now() < nextAllowSubmitAt) return

    // 本地锁定直接拦截
    if (lockUntil) {
      const remainingNow = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000))
      if (remainingNow > 0) {
        message.error(`账号已临时锁定 ${remainingNow} 秒`)
        touchSubmitCooldown(Math.min(remainingNow, 2))
        return
      }
    }

    if (!email || !password) {
      message.error('请填写邮箱和密码')
      touchSubmitCooldown(1)
      return
    }
    if (captchaRequired) {
      if (!captcha) {
        message.error('请输入验证码')
        touchSubmitCooldown(1)
        return
      }
      if (!captchaId) {
        message.error('验证码已失效，请点击刷新')
        await loadCaptcha()
        touchSubmitCooldown(1)
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

      // 成功清理
      localStorage.removeItem(failedKey(email))
      localStorage.removeItem(lockKey(email))
      localStorage.removeItem(FAILED_COUNT_KEY)
      localStorage.removeItem(LOCK_UNTIL_KEY)
      localStorage.removeItem(SERVER_CAPTCHA_FLAG)
      setLockUntil(null)
      setCaptcha('')
      setCaptchaId(null)
      setCaptchaImgUrl(undefined)
      setCaptchaByServer(false)
      setCaptchaByThreshold(false)
      touchSubmitCooldown(1)
      message.success('登录成功')
    } catch (err: any) {
      const { msg, code, status, data, retryAfterSec } = parseLoginError(err)
      const serverSaysLocked = code === CODE_LOCKED || code === CODE_LOCKED_LEGACY || status === 423

      if (serverSaysLocked) {
        const untilMs: number | undefined = data?.unlockAt
        const remainingSecFromBody: number | undefined = data?.remainingSec
        const lk = lockKey(email)
        const finalUntil =
          typeof untilMs === 'number' && untilMs > Date.now()
            ? untilMs
            : typeof remainingSecFromBody === 'number' && remainingSecFromBody > 0
            ? Date.now() + remainingSecFromBody * 1000
            : Date.now() + (retryAfterSec ? retryAfterSec * 1000 : 60 * 1000)

        setLockUntil(finalUntil)
        localStorage.setItem(lk, String(finalUntil))

        const secs = Math.max(1, Math.ceil((finalUntil - Date.now()) / 1000))
        message.error(`账号已临时锁定 ${secs} 秒`)

        // 结合 Retry-After 做节流（至少 1s）
        touchSubmitCooldown(Math.max(1, retryAfterSec ?? Math.min(secs, 2)))

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
        touchSubmitCooldown(1)
        message.error(msg || '验证码错误，请重试')
        return
      }
      if (isNeedCaptcha) {
        setCaptchaByServer(true)
        localStorage.setItem(SERVER_CAPTCHA_FLAG, '1')
        setCaptcha('')
        await loadCaptcha()
        touchSubmitCooldown(1)
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
        localStorage.setItem(fk, String(next))
        setFailedCount(next)
        if (settings?.enableCaptcha && next >= captchaThreshold) {
          setCaptchaByThreshold(true)
          if (!captchaRequired) {
            setCaptcha('')
            await loadCaptcha()
          }
        }
        if (next >= lockAfter) {
          const until = Date.now() + lockMinutes * 60 * 1000
          localStorage.setItem(lockKey(email), String(until))
          setLockUntil(until)
          const secs = Math.max(1, Math.ceil((until - Date.now()) / 1000))
          message.error(`账号已临时锁定 ${secs} 秒`)
          touchSubmitCooldown(2)
        } else {
          message.error(msg || '邮箱或密码错误，请检查后重试')
          touchSubmitCooldown(1)
        }
      } else {
        if (captchaRequired) {
          setCaptcha('')
          await loadCaptcha()
        }
        message.error(msg || '登录失败')
        touchSubmitCooldown(1)
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
    nextAllowSubmitAt,
    message,
    signIn,
    loadCaptcha,
    captchaThreshold,
    lockAfter,
    lockMinutes,
    settings?.enableCaptcha,
    touchSubmitCooldown,
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
    submitDisabled,
    inputsDisabled,
    captchaRequired,
    captcha,
    setCaptcha,
    captchaImgUrl,
    refreshCaptcha,
    isLocked,
    lockRemainingSec,
    lockCountdownText,
    lockUiHint,
    quickLogin: (em: string, pw = 'demo123456') => {
      setEmail(em)
      setPassword(pw)
    },
  }
}
