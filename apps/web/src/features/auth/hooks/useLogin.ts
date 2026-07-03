/* eslint-disable @typescript-eslint/no-explicit-any */
import { adminSettingsApi } from '@/shared/api/endpoints/admin-settings'
import { auth as authApi } from '@/shared/api/endpoints/auth'
import { useAuth } from '@/shared/contexts/AuthContext'
import { resetRemoteCryptoCache, tryEncryptRemote } from '@/shared/utils/cryptoLocal'
import { App } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { translate } from '@/shared/utils/i18n'

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

const keyFor = (b: string, em: string) => (em ? `${b}:${em.trim().toLowerCase()}` : '')
const failedKey = (em: string) => keyFor('login_failed_count', em) || 'login_failed_count:__none__'
const lockKey = (em: string) => keyFor('login_lock_until_ms', em) || 'login_lock_until_ms:__none__'
const lockTryKey = (em: string) => keyFor('login_locked_next_try_at', em) || 'login_locked_next_try_at:__none__'

type Settings = {
  enableCaptcha: boolean
  captchaAfterFailedAttempts: number
  lockAfterFailedAttempts: number
  lockMinutes: number
  loginLivenessLevel: 'none' | 'silent' | 'action'
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
  const lvl = raw?.loginLivenessLevel
  return {
    enableCaptcha,
    captchaAfterFailedAttempts: Number.isFinite(captchaAfterFailedAttempts) ? captchaAfterFailedAttempts : 3,
    lockAfterFailedAttempts: Number.isFinite(lockAfter) ? lockAfter : 6,
    lockMinutes: Number.isFinite(lockMinutes) ? lockMinutes : 5,
    loginLivenessLevel: lvl === 'none' || lvl === 'silent' || lvl === 'action' ? lvl : 'silent',
  }
}

function parseLoginError(err: any): {
  msg: string
  code?: string
  status?: number
  data?: any
  reason?: string
  retryAfterSec?: number
} {
  const res = err?.response
  const code = res?.data?.code
  const status = res?.status
  const backendMsg = res?.data?.message
  const data = res?.data?.data
  const reason = res?.data?.error?.details?.reason
  const rh = res?.headers || {}
  const retryAfter = rh['retry-after'] ? Number(rh['retry-after']) : undefined
  const msg = backendMsg || err?.message || '错误'
  return { msg, code, status, data, reason, retryAfterSec: Number.isFinite(retryAfter) ? Number(retryAfter) : undefined }
}

function svgToDataUrl(svg: string) {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg.replace(/\r?\n/g, ''))
}
const looksLikeBadCreds = (msg?: string) =>
  !!msg && /(用户名|邮箱|账号).*(密码).*(错误)|密码错误|credentials/i.test(msg || '')
const looksLikeNeedCaptcha = (msg?: string) => !!msg && /(请先完成验证码|验证码(错误|过期)|captcha)/i.test(msg || '')

type FaceFailureReason =
  | 'unsupported'
  | 'detector_unavailable'
  | 'camera_denied'
  | 'camera_unavailable'
  | 'no_face'
  | 'multiple_faces'
  | 'liveness_failed'
  | 'action_failed'
  | 'verification_failed'
  | 'not_enrolled'
  | 'unknown'

// 人脸失败原因 → 具体、可操作的提示（避免笼统的“核验失败”）
const FACE_FAIL_MESSAGE: Record<string, string> = {
  liveness_failed: '活体检测未通过：请在光线充足处正对摄像头，摘掉口罩/帽子，避免用照片或屏幕翻拍',
  action_failed: '未检测到转头动作：请按屏幕提示缓慢左右转动头部完成活体检测',
  no_face: '未检测到人脸：请让面部完整、清晰地出现在画面中央',
  multiple_faces: '画面中不止一张人脸：请确保只有本人出现在镜头前',
  not_enrolled: '该账号尚未录入人脸：请改用密码登录，或先在个人中心录入人脸',
  verification_failed: '人脸比对未通过：可能受光线或角度影响，请重试或改用密码登录',
}

function toMMSS(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec))
  const m = Math.floor(s / 60)
    .toString()
    .padStart(2, '0')
  const r = (s % 60).toString().padStart(2, '0')
  return `${m}:${r}`
}

// 摄像头采集已移交 FaceCaptureWizard 组件，这里不再做无界面抓帧。

export function useLogin() {
  const { message } = App.useApp()
  const { signIn, signInWithSession } = useAuth()

  // 表单
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [keep7Days, setKeep7Days] = useState(false)
  const [loading, setLoading] = useState(false)
  const [faceLoginLoading, setFaceLoginLoading] = useState(false)
  const [faceModalOpen, setFaceModalOpen] = useState(false)
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

  // 只禁用按钮（10s 冷却），输入框不受锁定影响
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
        setSettings({ enableCaptcha: true, captchaAfterFailedAttempts: 3, lockAfterFailedAttempts: 6, lockMinutes: 5, loginLivenessLevel: 'silent' })
      }
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      const rememberFlag = localStorage.getItem(REMEMBER_ME_FLAG) === '1'
      setRememberMe(rememberFlag)
      const lastEmail = localStorage.getItem(LAST_EMAIL_KEY) || ''
      setEmail(lastEmail)
      setPassword('')
      localStorage.removeItem(REMEMBER_PACK_KEY)
      const flag = localStorage.getItem(STORAGE_FLAG_KEY)
      setKeep7Days(flag === '7d')
      setCaptchaByServer(localStorage.getItem(SERVER_CAPTCHA_FLAG) === '1')
      setPrefsReady(true)
    })()
  }, [])

  // 恢复锁定 + 10s 重试时间（基于当前 email）
  useEffect(() => {
    if (!email) {
      setLockUntil(null)
      setLockedNextTryAt(0)
      return
    }
    const luRaw = localStorage.getItem(lockKey(email))
    const lu = Number(luRaw || 0)
    setLockUntil(Number.isFinite(lu) && lu > Date.now() ? lu : null)

    const tuRaw = localStorage.getItem(lockTryKey(email))
    const tu = Number(tuRaw || 0)
    setLockedNextTryAt(Number.isFinite(tu) && tu > Date.now() ? tu : 0)

    if (Number.isFinite(lu) && lu > 0 && lu <= Date.now()) {
      try {
        localStorage.removeItem(lockKey(email))
      } catch {}
    }
    if (Number.isFinite(tu) && tu > 0 && tu <= Date.now()) {
      try {
        localStorage.removeItem(lockTryKey(email))
      } catch {}
    }
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

  // 锁定过期清理（到点立即彻底清理）
  useEffect(() => {
    if (!lockUntil) return
    if (Date.now() >= lockUntil) {
      setLockUntil(null)
      setLockedNextTryAt(0)
      try {
        if (email) {
          localStorage.removeItem(lockKey(email))
          localStorage.removeItem(lockTryKey(email))
        }
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

  // 记住我只保留邮箱，不持久化密码或可还原凭据。
  const saveRemember = useCallback(
    async (em: string) => {
      if (!rememberMe) return
      localStorage.removeItem(REMEMBER_PACK_KEY)
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
        await saveRemember(email)
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
      saveRemember(email)
    }, 300)
    return () => window.clearTimeout(tid)
  }, [email, rememberMe, saveRemember, prefsReady])

  const applyFaceFailurePolicy = useCallback(
    async (data: any, fallbackMessage: string) => {
      if (data?.locked) {
        const unlockAt =
          typeof data.unlockAt === 'number' && data.unlockAt > Date.now()
            ? data.unlockAt
            : typeof data.remainingSec === 'number' && data.remainingSec > 0
            ? Date.now() + data.remainingSec * 1000
            : 0

        if (unlockAt > Date.now()) {
          setLockUntil(unlockAt)
          try {
            localStorage.setItem(lockKey(email), String(unlockAt))
          } catch {}
          const nextTry = Date.now() + 10_000
          setLockedNextTryAt(nextTry)
          try {
            localStorage.setItem(lockTryKey(email), String(nextTry))
          } catch {}
          const secs = Math.max(1, Math.ceil((unlockAt - Date.now()) / 1000))
          message.error(`人脸登录失败次数过多，账号已临时锁定 ${secs} 秒`)
        } else {
          message.error(translate('auto.9a28fb0669'))
        }
        return
      }

      if (data?.captchaRequired) {
        setCaptchaByServer(true)
        try {
          localStorage.setItem(SERVER_CAPTCHA_FLAG, '1')
        } catch {}
        setCaptcha('')
        await loadCaptcha()
        message.error(translate('auto.c85a13301e'))
        return
      }

      message.error(fallbackMessage)
    },
    [email, loadCaptcha, message]
  )

  const reportFaceLoginFailure = useCallback(
    async (
      reason: FaceFailureReason,
      stage: string,
      detector: Record<string, any> | undefined,
      fallbackMessage: string
    ) => {
      const loginEmail = email.trim()
      if (!loginEmail) {
        message.error(translate('auto.e435dc0a34'))
        return
      }

      const resp = await authApi.reportFaceLoginFailure({ email: loginEmail, reason, stage, detector })
      if (!(resp as any)?.success) {
        message.error((resp as any)?.error || translate('auto.a2fc9559a0'))
        return
      }
      await applyFaceFailurePolicy((resp as any).data, fallbackMessage)
    },
    [applyFaceFailurePolicy, email, message]
  )

  // 点「人脸登录」：直接打开采集弹窗（1:N 刷脸，无需先填邮箱）
  const faceLogin = useCallback(() => {
    if (isLocked && lockTryRemainSec > 0) return
    if (!navigator.mediaDevices?.getUserMedia) {
      message.error(translate('auto.7df64c2a8f'))
      return
    }
    setFaceModalOpen(true)
  }, [isLocked, lockTryRemainSec, message])

  const closeFaceModal = useCallback(() => setFaceModalOpen(false), [])

  // 采集弹窗回传帧 → 服务端活体+1:1 比对 → 命中则登录
  const faceCaptureSubmit = useCallback(
    async (images: string[]) => {
      if (!images.length) {
        message.error(translate('auto.6790993615'))
        return
      }
      setFaceLoginLoading(true)
      try {
        // 填了邮箱走 1:1，否则走 1:N 直接刷脸识别
        const resp = await authApi.faceLoginVerify({ email: email.trim() || undefined, images, keep7Days })
        if ((resp as any)?.success === false) {
          message.error((resp as any)?.error || translate('auto.437bf3c418'))
          return
        }

        const data = (resp as any).data
        if (data?.matched && data?.token && data?.user) {
          setFaceModalOpen(false)
          await signInWithSession(data.token, data.user, keep7Days)
          message.success(translate('auto.9579e9ee6a'))
          return
        }

        const reason = (data?.reason as string) || 'verification_failed'
        const specificMsg =
          FACE_FAIL_MESSAGE[reason] || data?.message || '人脸验证未通过，请重试或使用密码登录'
        // 1:N 刷脸（未填邮箱）：reportFaceLoginFailure 需要邮箱做锁定计数，会吞掉真实原因，
        // 因此直接展示具体提示；仅 1:1（填了邮箱）才走失败计数策略。
        if (email.trim()) {
          // 上报真实原因，由服务端按 NOT_COUNTED 决定是否计入锁定
          // （活体/无脸/多脸等不计入，只有真正的人脸不匹配才计入）
          await reportFaceLoginFailure(
            reason as any,
            'verify',
            { api: 'server', similarity: data?.similarity },
            specificMsg
          )
        } else {
          message.error(specificMsg)
        }
      } catch (e: any) {
        message.error(e?.message || translate('auto.437bf3c418'))
      } finally {
        setFaceLoginLoading(false)
      }
    },
    [email, keep7Days, message, reportFaceLoginFailure, signInWithSession]
  )

  // —— 提交 —— //
  const submit = useCallback(async () => {
    // 锁定 + 10s 冷却未到：禁止提交
    if (isLocked && lockTryRemainSec > 0) return

    if (!email || !password) {
      message.error(translate('auto.45398d93e0'))
      return
    }
    if (captchaRequired) {
      if (!captcha) {
        message.error(translate('account.code_required'))
        return
      }
      if (!captchaId) {
        message.error(translate('auto.b9edd1304c'))
        await loadCaptcha()
        return
      }
    }

    setLoading(true)
    let usedRemoteCrypto = false
    const finishSuccess = () => {
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
      message.success(translate('auto.2991317aba'))
    }
    try {
      localStorage.setItem(STORAGE_FLAG_KEY, keep7Days ? '7d' : 'session')
      try {
        localStorage.setItem(LAST_EMAIL_KEY, email || '')
      } catch {}

      const remote = await tryEncryptRemote({ email, password, captcha, captchaId: captchaId || undefined })
      usedRemoteCrypto = !!remote
      const extra = {
        captcha: captchaRequired ? captcha : undefined,
        captchaId: captchaRequired ? captchaId || undefined : undefined,
        ...(remote ?? {}),
        keep7Days,
      }
      await signIn(email, password, keep7Days, extra)

      finishSuccess()
    } catch (err: any) {
      const { msg, code, status, data, reason, retryAfterSec } = parseLoginError(err)

      if (usedRemoteCrypto && reason === 'CRED_DECRYPT_FAILED') {
        resetRemoteCryptoCache()
        const freshRemote = await tryEncryptRemote({ email, password, captcha, captchaId: captchaId || undefined })
        if (freshRemote) {
          try {
            await signIn(email, password, keep7Days, {
              captcha: captchaRequired ? captcha : undefined,
              captchaId: captchaRequired ? captchaId || undefined : undefined,
              ...freshRemote,
              keep7Days,
            })
            finishSuccess()
            return
          } catch (retryErr: any) {
            err = retryErr
          }
        }
      }

      const parsedRetry = parseLoginError(err)
      const finalMsg = parsedRetry.msg
      const finalCode = parsedRetry.code
      const finalStatus = parsedRetry.status
      const finalData = parsedRetry.data
      const finalRetryAfterSec = parsedRetry.retryAfterSec
      const serverSaysLocked = finalCode === CODE_LOCKED || finalCode === CODE_LOCKED_LEGACY || finalStatus === 423

      if (serverSaysLocked) {
        // ✅ 仅当后端明确锁定时，前端进入锁态
        const untilMsFromServer: number | undefined = finalData?.unlockAt
        const remainSecFromServer: number | undefined = finalData?.remainingSec
        const retry =
          Number.isFinite(finalRetryAfterSec) && (finalRetryAfterSec as number) > 0
            ? (finalRetryAfterSec as number)
            : 0

        let finalUntil = 0
        if (typeof untilMsFromServer === 'number' && untilMsFromServer > Date.now()) {
          finalUntil = untilMsFromServer
        } else if (typeof remainSecFromServer === 'number' && remainSecFromServer > 0) {
          finalUntil = Date.now() + remainSecFromServer * 1000
        } else if (retry > 0) {
          finalUntil = Date.now() + retry * 1000
        }

        if (finalUntil > Date.now()) {
          setLockUntil(finalUntil)
          try {
            localStorage.setItem(lockKey(email), String(finalUntil))
          } catch {}
          const nextTry = Date.now() + 10_000
          setLockedNextTryAt(nextTry)
          try {
            localStorage.setItem(lockTryKey(email), String(nextTry))
          } catch {}
          const secs = Math.max(1, Math.ceil((finalUntil - Date.now()) / 1000))
          message.error(`账号已临时锁定 ${secs} 秒`)
        } else {
          // 边界：后端几乎到点，不做本地锁
          setLockUntil(null)
          setLockedNextTryAt(0)
          try {
            localStorage.removeItem(lockKey(email))
            localStorage.removeItem(lockTryKey(email))
          } catch {}
        }

        if (captchaRequired) {
          setCaptcha('')
          await loadCaptcha()
        }
        return
      }

      const isNeedCaptcha = finalCode === CODE_NEED_CAPTCHA || looksLikeNeedCaptcha(finalMsg)
      const isBadCaptcha = finalCode === CODE_BAD_CAPTCHA
      const isBadCreds = finalCode === CODE_BAD_CREDS || finalStatus === HTTP_UNAUTH || looksLikeBadCreds(finalMsg)

      if (isBadCaptcha) {
        setCaptcha('')
        await loadCaptcha()
        message.error(finalMsg || translate('auto.12d8c11d1c'))
        return
      }
      if (isNeedCaptcha) {
        setCaptchaByServer(true)
        try {
          localStorage.setItem(SERVER_CAPTCHA_FLAG, '1')
        } catch {}
        setCaptcha('')
        await loadCaptcha()
        message.error(msg || translate('auto.1b3b2aa3c9'))
        return
      }
      if (isBadCreds) {
        // ❌ 不再本地加锁，由后端决定
        const fk = failedKey(email)
        const cur = Number(localStorage.getItem(fk) || 0) || 0
        const next = cur + 1
        try {
          localStorage.setItem(fk, String(next))
        } catch {}

        // 只负责触发验证码阈值
        if (settings?.enableCaptcha && next >= captchaThreshold) {
          setCaptchaByThreshold(true)
          if (!captchaRequired) {
            setCaptcha('')
            await loadCaptcha()
          }
        }

        message.error(finalMsg || translate('auto.e64880a1b1'))
        return
      }

      // 其它错误
      if (captchaRequired) {
        setCaptcha('')
        await loadCaptcha()
      }
      message.error(finalMsg || translate('auto.aeb6c8a818'))
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
    lockAfter, // 仍可保留（不再用于本地锁），仅为依赖稳定
    lockMinutes, // 同上
    settings?.enableCaptcha,
  ])

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
    faceLoginLoading,

    // 提交 & 控制
    submit,
    faceLogin,
    faceModalOpen,
    faceCaptureSubmit,
    closeFaceModal,
    faceActionMode: settings?.loginLivenessLevel === 'action',
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
