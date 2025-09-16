/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Response } from 'express'
import type { AuthRequest } from '@/types/auth'
import type { ApiResponse } from '@/types/response'
import { CODES } from '@/types/response'

import { AuthService } from '../services/auth.service'
import { AdminSettingsService } from '@/modules/admin-settings/services/admin-settings.service'
import CaptchaService from '@/modules/auth/services/captcha.service'
import { LoginFailureRepository } from '@/modules/auth/repositories/login-failure.repository'
import { CryptoService } from '@/modules/auth/services/crypto.service'

const svc = new AuthService()

export class AuthController {
  static async register(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const { username, email, password } = req.body || {}
      if (!email || !password) {
        return (res as any).badRequest('缺少必填字段', {
          error: { details: [{ field: 'email/password', message: '必填' }] },
        })
      }
      const { token, refresh, user } = await svc.register({ username, email, password }, {
        ip: req.ip,
        ua: req.get('User-Agent') || undefined,
      })
      svc.setRefreshCookie(res, refresh)
      return (res as any).created({ token, user }, '注册成功')
    } catch (e: any) {
      return (res as any).internal(e?.message || '创建用户失败')
    }
  }

  static async login(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const settings = await AdminSettingsService.getSafe()
      const enableCaptcha = !!(settings as any).enableCaptcha
      const afterN = Math.max(0, Number((settings as any).captchaAfterFailed ?? 0))

      let { email, password, captcha, captchaId, enc, alg } = (req.body || {}) as any
      enc = enc || req.get('x-cred-enc')
      alg = (alg || req.get('x-cred-alg') || '').toString()

      if (enc && alg.toUpperCase().includes('RSA-OAEP')) {
        const dec = CryptoService.decryptLoginCred(String(enc))
        email = dec.email
        password = dec.password
      }

      if (!email || !password) {
        return (res as any).badRequest('缺少必填字段', {
          error: { details: [{ field: 'email/password', message: '必填' }] },
        })
      }

      const ip = req.ip || ''
      let mustCaptcha = false
      if (enableCaptcha) {
        if (afterN === 0) {
          mustCaptcha = true
        } else {
          const rec = await LoginFailureRepository.get(email, ip)
          if (rec && rec.fail_count >= afterN) mustCaptcha = true
        }
      }

      if (mustCaptcha) {
        if (!captcha || !captchaId) {
          return (res as any).fail(CODES.AUTH_NEED_CAPTCHA, 400, '请先完成验证码', {
            error: { retryable: true, docUrl: '/docs/captcha' },
          })
        }
        const ok = CaptchaService.verify(String(captchaId), String(captcha))
        if (!ok) {
          await LoginFailureRepository.increase(email, ip)
          return (res as any).badRequest('验证码错误或已过期', {
            code: CODES.AUTH_NEED_CAPTCHA, // 或单独业务码 CODES.AUTH_BAD_CAPTCHA
            error: { retryable: true },
          })
        }
      }

      try {
        const { token, refresh, user } = await svc.login(email, password, {
          ip,
          ua: req.get('User-Agent') || undefined,
        })
        await LoginFailureRepository.reset(email, ip)
        svc.setRefreshCookie(res, refresh)
        return (res as any).ok({ token, user }, '登录成功')
      } catch (e: any) {
        await LoginFailureRepository.increase(email, ip)
        const msg = e?.message || '登录失败'
        // 密码/用户不存在/禁用 -> 401/403
        if (/不存在|密码|用户名|账号/.test(msg)) {
          const isForbidden = /禁用|停用/.test(msg)
          return (res as any)[isForbidden ? 'forbidden' : 'unauthorized'](
              isForbidden ? '账号已被禁用' : '用户名或密码错误',
              { code: CODES.AUTH_BAD_CREDENTIALS, error: { retryable: true } }
          )
        }
        return (res as any).internal(msg)
      }
    } catch (e: any) {
      return (res as any).internal(e?.message || '登录失败')
    }
  }

  static async refresh(req: AuthRequest, res: Response<ApiResponse<{ token: string }>>) {
    try {
      const rt = (req as any)?.cookies?.rt || req.body?.refresh_token || req.get('x-refresh-token')
      if (!rt) return (res as any).unauthorized('缺少刷新令牌', { code: CODES.AUTH_UNAUTHORIZED })
      const { token, refresh } = await svc.refresh(rt)
      svc.setRefreshCookie(res as any, refresh)
      return (res as any).ok({ token }, '刷新成功')
    } catch (e: any) {
      return (res as any).unauthorized(e?.message || '刷新失败，请重新登录', { code: CODES.AUTH_UNAUTHORIZED })
    }
  }

  static async logout(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const rt = (req as any)?.cookies?.rt || req.body?.refresh_token || req.get('x-refresh-token')
      await svc.logout(rt, { ip: req.ip, ua: req.get('User-Agent') || undefined })
    } finally {
      ;(res as any).clearCookie?.('rt', { path: '/api/auth' })
    }
    return (res as any).ok(null, '已登出')
  }
}
