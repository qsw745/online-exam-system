/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Response } from 'express'
import type { AuthRequest } from '@/types/auth'
import type { ApiResponse } from '@/types/response'
import { CODES, SUBCODES } from '@/types/response'

import { AuthService } from '../services/auth.service'
import { AdminSettingsService } from '@/modules/admin-settings/services/admin-settings.service'
import CaptchaService from '@/modules/auth/services/captcha.service'
import { CryptoService } from '@/modules/auth/services/crypto.service'
import { AuthLockService } from '@/modules/auth/services/auth-lock.service'
import { getClientIp } from '@/common/utils/request-ip'
import Geo from '@/common/utils/geo'
import { OAuthService } from '@/modules/auth/services/oauth.service'
import { LogService } from '@/modules/logs/services/log.service'
import { UserRepository } from '@/modules/auth/repositories/user.repository'

const svc = new AuthService()
const OAUTH_STATE_COOKIE = 'oauth_state'

const FACE_FAILURE_REASON_LABELS: Record<string, string> = {
  unsupported: '浏览器不支持摄像头访问',
  detector_unavailable: '本地人脸检测能力不可用',
  camera_denied: '摄像头权限被拒绝',
  camera_unavailable: '摄像头不可用',
  no_face: '未检测到人脸',
  multiple_faces: '检测到多张人脸',
  liveness_failed: '活体检测未通过',
  action_failed: '动作活体未通过',
  verification_failed: '人脸识别未通过',
  not_enrolled: '未录入人脸凭据',
  unknown: '未知原因',
}

// 仅“真正的人脸不匹配 verification_failed”计入账号锁定；
// 活体/画质/摄像头等环境类失败不计入，避免合法用户几次没过就被锁号（连密码都登不了）。
const FACE_FAILURE_REASONS_NOT_COUNTED = new Set([
  'unsupported',
  'detector_unavailable',
  'camera_denied',
  'camera_unavailable',
  'not_enrolled',
  'no_face',
  'multiple_faces',
  'liveness_failed',
  'action_failed',
])

function normalizeFaceFailureReason(raw: unknown) {
  const value = String(raw || '').trim().toLowerCase()
  return FACE_FAILURE_REASON_LABELS[value] ? value : 'unknown'
}

function lockPayload(untilMs: number, remainSec: number, lockMinutes: number) {
  const until = new Date(untilMs)
  const unlockDate = `${until.getFullYear()}-${String(until.getMonth() + 1).padStart(2, '0')}-${String(
    until.getDate()
  ).padStart(2, '0')}`
  return { locked: true, unlockAt: untilMs, remainingSec: remainSec, unlockDate, lockMinutes }
}

function oauthCookieOptions(maxAgeMs?: number) {
  const isProd = process?.env?.NODE_ENV === 'production'
  return { httpOnly: true, secure: isProd, sameSite: 'lax' as const, path: '/', maxAge: maxAgeMs }
}

export class AuthController {
  static async register(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const { email, password, nickname, keep7Days } = (req.body || {}) as any
      if (!email || !password) {
        return (res as any).badRequest('缺少必填字段', {
          error: { details: [{ field: 'email/password', message: '必填' }] },
        })
      }
      const result = await svc.register(
        { email, password, nickname: nickname ?? null },
        { ip: getClientIp(req) || req.ip, ua: req.get('User-Agent') || undefined },
        { persist: !!keep7Days }
      )
      // 开启邮箱验证：不自动登录，提示去邮箱激活
      if ((result as any).needVerification) {
        return (res as any).created(
          { needVerification: true, email: (result as any).email },
          '注册成功，请前往注册邮箱完成验证后再登录'
        )
      }
      const { token, refresh, user, persist } = result as any
      svc.setRefreshCookie(res, refresh, { persist })
      return (res as any).created({ token, user }, '注册成功')
    } catch (e: any) {
      const msg = String(e?.message || '')
      if (msg.includes('jsonwebtoken 模块未安装或无法加载')) {
        return (res as any).fail(CODES.INTERNAL_ERROR, 503, '服务器依赖未就绪：请安装 jsonwebtoken 后再试', {
          error: { retryable: true },
        })
      }
      if (msg.includes('用户已存在') || msg.includes('邮箱已被占用')) {
        return (res as any).badRequest('邮箱已被占用', {
          code: CODES.VALIDATION_ERROR,
          error: { retryable: false, details: [{ field: 'email', message: '已被占用' }] },
        })
      }
      return (res as any).internal(msg || '创建用户失败')
    }
  }

  /** 登录（锁定+验证码），只支持邮箱 */
  static async login(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const settings = await AdminSettingsService.getSafe()
      const enableCaptcha = !!(settings as any).enableCaptcha

      const captchaAfter = Number(
        (settings as any).captchaAfterFailedAttempts ??
          (settings as any).captchaAfterFailed ??
          (settings as any).captcha_after_failed ??
          3
      )
      const lockAfter = Number(
        (settings as any).lockAfterFailedAttempts ??
          (settings as any).lockAfterFailed ??
          (settings as any).lock_after_failed ??
          Math.max(captchaAfter + 2, 6)
      )
      const lockMinutes = Number((settings as any).lockMinutes ?? (settings as any).lock_minutes ?? 5)

      const lockSvc = new AuthLockService(lockMinutes)

      let { email, password, captcha, captchaId, enc, alg, keep7Days } = (req.body || {}) as any
      enc = enc || req.get('x-cred-enc')
      alg = (alg || req.get('x-cred-alg') || '').toString()

      // 支持 RSA-OAEP-256 加密凭据
      if (enc && /RSA-OAEP/i.test(alg)) {
        try {
          const dec = CryptoService.decryptLoginCred(String(enc))
          email = dec.email
          password = dec.password
        } catch {
          if (!email || !password) {
            return (res as any).badRequest('登录凭据解密失败', {
              code: CODES.VALIDATION_ERROR,
              error: { retryable: false, details: { reason: 'CRED_DECRYPT_FAILED' } },
            })
          }
        }
      }

      const loginEmail = typeof email === 'string' ? email.trim() : email
      const plainPwd = typeof password === 'string' ? password : password

      if (!loginEmail || !plainPwd) {
        return (res as any).badRequest('缺少必填字段', {
          error: { details: [{ field: 'email/password', message: '必填' }] },
        })
      }

      const ip = getClientIp(req) || req.ip || ''

      await lockSvc.unlockIfExpired(loginEmail, ip)
      await lockSvc.decayOldFails(loginEmail, ip, lockMinutes)

      const rec = await lockSvc.getRecord(loginEmail, ip)
      if (rec?.locked_until && new Date(rec.locked_until).getTime() > Date.now()) {
        const untilMs = new Date(rec.locked_until).getTime()
        const remainSec = Math.max(1, Math.ceil((untilMs - Date.now()) / 1000))
        const until = new Date(untilMs)
        const ymd = `${until.getFullYear()}-${String(until.getMonth() + 1).padStart(2, '0')}-${String(
          until.getDate()
        ).padStart(2, '0')}`
        return (res as any).fail(CODES.AUTH_LOCKED, 423, '账号已临时锁定', {
          error: { retryable: true },
          subcode: SUBCODES.AUTH_LOCKED,
          meta: { lockMinutes },
          headers: { 'Retry-After': String(remainSec) },
          data: { unlockAt: untilMs, remainingSec: remainSec, unlockDate: ymd },
        })
      }

      // 验证码
      let mustCaptcha = false
      if (enableCaptcha) {
        if (captchaAfter <= 0) mustCaptcha = true
        else if ((rec?.fail_count ?? 0) >= captchaAfter) mustCaptcha = true
      }
      const clientProvidedCaptcha = !!(captchaId && captcha)
      const shouldVerifyCaptcha = enableCaptcha && (mustCaptcha || clientProvidedCaptcha)

      if (shouldVerifyCaptcha) {
        if (!captcha || !captchaId) {
          return (res as any).fail(CODES.AUTH_NEED_CAPTCHA, 400, '请先完成验证码', { error: { retryable: true } })
        }
        const ok = await CaptchaService.verify(String(captchaId), String(captcha))
        if (!ok) {
          const next = await lockSvc.hitFail(loginEmail, ip)
          if (next >= lockAfter) {
            const { untilMs, remainSec } = await lockSvc.lock(loginEmail, ip, lockMinutes, next)
            const until = new Date(untilMs)
            const ymd = `${until.getFullYear()}-${String(until.getMonth() + 1).padStart(2, '0')}-${String(
              until.getDate()
            )}`
            return (res as any).fail(CODES.AUTH_LOCKED, 423, `密码连续错误过多，账号已锁定 ${lockMinutes} 分钟`, {
              error: { retryable: true },
              subcode: SUBCODES.AUTH_LOCKED,
              meta: { lockMinutes },
              headers: { 'Retry-After': String(remainSec) },
              data: { unlockAt: untilMs, remainingSec: remainSec, unlockDate: ymd },
            })
          }
          return (res as any).badRequest('验证码错误或已过期', {
            code: CODES.AUTH_NEED_CAPTCHA,
            error: { retryable: true },
          })
        }
      }

      try {
        const { token, refresh, user, persist } = await svc.login(
          loginEmail,
          plainPwd,
          { ip, ua: req.get('User-Agent') || undefined },
          { persist: !!keep7Days }
        )
        const location = await Geo.lookup(ip)

        await lockSvc.reset(loginEmail, ip)
        svc.setRefreshCookie(res, refresh, { persist })

        return (res as any).ok({ token, user, location }, '登录成功')
      } catch (e: any) {
        const next = await lockSvc.hitFail(loginEmail, ip)
        if (next >= lockAfter) {
          const { untilMs, remainSec } = await lockSvc.lock(loginEmail, ip, lockMinutes, next)
          const until = new Date(untilMs)
          const ymd = `${until.getFullYear()}-${String(until.getMonth() + 1).padStart(2, '0')}-${String(
            until.getDate()
          )}`
          return (res as any).fail(CODES.AUTH_LOCKED, 423, `密码连续错误过多，账号已锁定 ${lockMinutes} 分钟`, {
            error: { retryable: true },
            subcode: SUBCODES.AUTH_LOCKED,
            meta: { lockMinutes },
            headers: { 'Retry-After': String(remainSec) },
            data: { unlockAt: untilMs, remainingSec: remainSec, unlockDate: ymd },
          })
        }
        const msg = e?.message || '登录失败'
        const isForbidden = /禁用|停用/.test(msg)
        return (res as any)[isForbidden ? 'forbidden' : 'unauthorized'](
          isForbidden ? '账号已被禁用' : '邮箱或密码错误',
          { code: CODES.AUTH_BAD_CREDENTIALS, error: { retryable: true } }
        )
      }
    } catch (e: any) {
      const msg = String(e?.message || '')
      if (msg.includes('jsonwebtoken 模块未安装或无法加载')) {
        return (res as any).fail(CODES.INTERNAL_ERROR, 503, '服务器依赖未就绪：请安装 jsonwebtoken 后再试', {
          error: { retryable: true },
        })
      }
      return (res as any).internal(msg || '登录失败')
    }
  }

  /** 人脸登录失败上报：复用登录失败计数、验证码阈值和锁定策略，不接收或保存人脸图像 */
  static async reportFaceLoginFailure(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const settings = await AdminSettingsService.getSafe()
      const enableCaptcha = !!(settings as any).enableCaptcha
      const captchaAfter = Number(
        (settings as any).captchaAfterFailedAttempts ??
          (settings as any).captchaAfterFailed ??
          (settings as any).captcha_after_failed ??
          3
      )
      const lockAfter = Number(
        (settings as any).lockAfterFailedAttempts ??
          (settings as any).lockAfterFailed ??
          (settings as any).lock_after_failed ??
          Math.max(captchaAfter + 2, 6)
      )
      const lockMinutes = Number((settings as any).lockMinutes ?? (settings as any).lock_minutes ?? 5)
      const lockSvc = new AuthLockService(lockMinutes)

      const { email, reason, stage, detector } = (req.body || {}) as any
      const loginEmail = typeof email === 'string' ? email.trim() : ''
      if (!loginEmail) {
        return (res as any).badRequest('请先填写邮箱后再使用人脸登录', {
          code: CODES.VALIDATION_ERROR,
          error: { retryable: false, details: [{ field: 'email', message: '必填' }] },
        })
      }

      const ip = getClientIp(req) || req.ip || ''
      const ua = req.get('User-Agent') || undefined
      const normalizedReason = normalizeFaceFailureReason(reason)
      const reasonLabel = FACE_FAILURE_REASON_LABELS[normalizedReason]
      const counted = !FACE_FAILURE_REASONS_NOT_COUNTED.has(normalizedReason)

      await lockSvc.unlockIfExpired(loginEmail, ip)
      await lockSvc.decayOldFails(loginEmail, ip, lockMinutes)

      const existingLock = await lockSvc.isLocked(loginEmail, ip)
      const current = await lockSvc.getRecord(loginEmail, ip)

      if (existingLock.locked) {
        await LogService.log({
          type: 'login',
          status: 'failed',
          action: '人脸登录',
          message: '人脸登录失败：账号已临时锁定',
          details: {
            email: loginEmail,
            reason: normalizedReason,
            reasonLabel,
            counted: false,
            source: 'face_login',
            stage: typeof stage === 'string' ? stage.slice(0, 80) : undefined,
          },
          ipAddress: ip,
          userAgent: ua,
        } as any)
        return (res as any).ok(
          {
            counted: false,
            failedAttempts: current?.fail_count ?? 0,
            captchaRequired: false,
            ...lockPayload(existingLock.untilMs, existingLock.remainSec, lockMinutes),
          },
          '账号已临时锁定'
        )
      }

      let next = current?.fail_count ?? 0
      let locked: ReturnType<typeof lockPayload> | null = null
      if (counted) {
        next = await lockSvc.hitFail(loginEmail, ip)
        if (next >= lockAfter) {
          const { untilMs, remainSec } = await lockSvc.lock(loginEmail, ip, lockMinutes, next)
          locked = lockPayload(untilMs, remainSec, lockMinutes)
        }
      }

      const user = await UserRepository.findByLogin(loginEmail).catch(() => null)
      await LogService.log({
        type: 'login',
        status: 'failed',
        userId: user?.id,
        action: '人脸登录',
        message: `人脸登录失败：${reasonLabel}`,
        details: {
          email: loginEmail,
          reason: normalizedReason,
          reasonLabel,
          counted,
          failedAttempts: next,
          lockAfter,
          source: 'face_login',
          stage: typeof stage === 'string' ? stage.slice(0, 80) : undefined,
          detector: detector && typeof detector === 'object' ? detector : undefined,
        },
        ipAddress: ip,
        userAgent: ua,
      } as any)

      return (res as any).ok(
        {
          counted,
          reason: normalizedReason,
          reasonLabel,
          failedAttempts: next,
          remainingBeforeLock: counted ? Math.max(0, lockAfter - next) : null,
          captchaRequired: counted && enableCaptcha && next >= captchaAfter,
          lockAfter,
          ...(locked || { locked: false, lockMinutes }),
        },
        locked ? `人脸登录失败次数过多，账号已锁定 ${lockMinutes} 分钟` : '已记录人脸登录失败'
      )
    } catch (e: any) {
      return (res as any).internal(e?.message || '记录人脸登录失败失败')
    }
  }

  static async refresh(req: AuthRequest, res: Response<ApiResponse<{ token: string }>>) {
    try {
      const rt = (req as any)?.cookies?.rt || req.body?.refresh_token || req.get('x-refresh-token')
      if (!rt) return (res as any).unauthorized('缺少刷新令牌', { code: CODES.AUTH_UNAUTHORIZED })
      const { token, refresh, persist, remainMs } = await svc.refresh(rt)
      svc.setRefreshCookie(res as any, refresh, { persist, maxAgeMs: remainMs })
      return (res as any).ok({ token }, '刷新成功')
    } catch (e: any) {
      svc.clearRefreshCookie(res as any)
      return (res as any).unauthorized(e?.message || '刷新失败，请重新登录', { code: CODES.AUTH_UNAUTHORIZED })
    }
  }

  static async logout(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const rt = (req as any)?.cookies?.rt || req.body?.refresh_token || req.get('x-refresh-token')
      await svc.logout(rt, { ip: getClientIp(req) || req.ip, ua: req.get('User-Agent') || undefined })
    } finally {
      svc.clearRefreshCookie(res as any)
    }
    return (res as any).ok(null, '已登出')
  }

  static async oauthProviders(_req: AuthRequest, res: Response<ApiResponse<any>>) {
    return (res as any).ok({ providers: OAuthService.providers() }, 'OK')
  }

  static async oauthStart(req: AuthRequest, res: Response<ApiResponse<any>>) {
    const provider = OAuthService.normalizeProvider(req.params.provider)
    if (!provider) return (res as any).notFound('不支持的登录方式')
    try {
      const auth = await OAuthService.createAuthorization(provider, req)
      ;(res as any).cookie?.(OAUTH_STATE_COOKIE, auth.state, oauthCookieOptions(auth.ttlSec * 1000))
      return res.redirect(auth.url)
    } catch (e: any) {
      return (res as any).badRequest(e?.message || '第三方登录未配置')
    }
  }

  static async oauthCallback(req: AuthRequest, res: Response<ApiResponse<any>>) {
    const provider = OAuthService.normalizeProvider(req.params.provider)
    if (!provider) return res.redirect(OAuthService.frontendCallbackUrl(req, { error: 'unsupported_provider' }))
    try {
      const { profile, keep7Days, next } = await OAuthService.consumeCallback(provider, req)
      const { refresh, persist } = await svc.loginWithOAuth(
        profile,
        { ip: getClientIp(req) || req.ip, ua: req.get('User-Agent') || undefined },
        { persist: keep7Days }
      )
      svc.setRefreshCookie(res as any, refresh, { persist })
      ;(res as any).clearCookie?.(OAUTH_STATE_COOKIE, oauthCookieOptions())
      return res.redirect(
        OAuthService.frontendCallbackUrl(req, {
          mode: persist ? '7d' : 'session',
          next,
        })
      )
    } catch (e: any) {
      ;(res as any).clearCookie?.(OAUTH_STATE_COOKIE, oauthCookieOptions())
      return res.redirect(OAuthService.frontendCallbackUrl(req, { error: 'oauth_failed' }))
    }
  }
}

export default AuthController
