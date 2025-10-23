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

const svc = new AuthService()

export class AuthController {
  static async register(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const { email, password, nickname, keep7Days } = (req.body || {}) as any
      if (!email || !password) {
        return (res as any).badRequest('缺少必填字段', {
          error: { details: [{ field: 'email/password', message: '必填' }] },
        })
      }
      const { token, refresh, user, persist } = await svc.register(
        { email, password, nickname: nickname ?? null },
        { ip: getClientIp(req) || req.ip, ua: req.get('User-Agent') || undefined },
        { persist: !!keep7Days }
      )
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
          isForbidden ? '账号已被禁用' : '用户名或密码错误',
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

  static async refresh(req: AuthRequest, res: Response<ApiResponse<{ token: string }>>) {
    try {
      const rt = (req as any)?.cookies?.rt || req.body?.refresh_token || req.get('x-refresh-token')
      if (!rt) return (res as any).unauthorized('缺少刷新令牌', { code: CODES.AUTH_UNAUTHORIZED })
      const { token, refresh, persist, remainMs } = await svc.refresh(rt)
      svc.setRefreshCookie(res as any, refresh, { persist, maxAgeMs: remainMs })
      return (res as any).ok({ token }, '刷新成功')
    } catch (e: any) {
      ;(res as any).clearCookie?.('rt', { path: '/api/auth' })
      return (res as any).unauthorized(e?.message || '刷新失败，请重新登录', { code: CODES.AUTH_UNAUTHORIZED })
    }
  }

  static async logout(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const rt = (req as any)?.cookies?.rt || req.body?.refresh_token || req.get('x-refresh-token')
      await svc.logout(rt, { ip: getClientIp(req) || req.ip, ua: req.get('User-Agent') || undefined })
    } finally {
      ;(res as any).clearCookie?.('rt', { path: '/api/auth' })
    }
    return (res as any).ok(null, '已登出')
  }
}

export default AuthController
