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

const svc = new AuthService()

export class AuthController {
    /** 注册 */
    static async register(req: AuthRequest, res: Response<ApiResponse<any>>) {
        try {
            const { username, email, password, keep7Days } = (req.body || {}) as any
            if (!email || !password) {
                return (res as any).badRequest('缺少必填字段', { error: { details: [{ field: 'email/password', message: '必填' }] } })
            }
            const { token, refresh, user, persist } = await svc.register(
                { username, email, password },
                { ip: req.ip, ua: req.get('User-Agent') || undefined },
                { persist: !!keep7Days }
            )
            svc.setRefreshCookie(res, refresh, { persist })
            return (res as any).created({ token, user }, '注册成功')
        } catch (e: any) {
            return (res as any).internal(e?.message || '创建用户失败')
        }
    }

    /** 登录（锁定+验证码，锁过期自动清零 fail_count，过期计数自动衰减） */
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

            // 支持前端加密传输（失败则回落到明文字段，如果也没有就 400）
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

            if (!email || !password) {
                return (res as any).badRequest('缺少必填字段', {
                    error: { details: [{ field: 'email/password', message: '必填' }] },
                })
            }

            const ip = req.ip || ''

            // —— 0) 标准化登录状态（关键修复点） —— //
            // 1. 若锁已过期：清空 locked_until 且把 fail_count 置 0
            await lockSvc.unlockIfExpired(email, ip)
            // 2. 若 last_failed_at 早于 lockMinutes 窗口：把 fail_count 置 0（过期计数衰减）
            await lockSvc.decayOldFails(email, ip, lockMinutes)

            // 再读取最新记录
            let rec = await lockSvc.getRecord(email, ip)

            // 若仍在锁定期：直接 423 返回
            if (rec?.locked_until && new Date(rec.locked_until).getTime() > Date.now()) {
                const untilMs = new Date(rec.locked_until).getTime()
                const remainSec = Math.max(1, Math.ceil((untilMs - Date.now()) / 1000))
                const until = new Date(untilMs)
                const ymd = `${until.getFullYear()}-${String(until.getMonth() + 1).padStart(2, '0')}-${String(until.getDate()).padStart(2, '0')}`
                return (res as any).fail(CODES.AUTH_LOCKED, 423, '账号已临时锁定', {
                    error: { retryable: true },
                    subcode: SUBCODES.AUTH_LOCKED,
                    meta: { lockMinutes },
                    headers: { 'Retry-After': String(remainSec) },
                    data: { unlockAt: untilMs, remainingSec: remainSec, unlockDate: ymd },
                })
            }

            // ⚠️ 修复：不再根据 “fail_count >= lockAfter 但 locked_until 为空” 进行 “补锁”
            // 让是否加锁由本次校验失败后的 hitFail 决定，避免“刚解锁又被补锁”的体验

            // —— 1) 验证码需求 —— //
            let mustCaptcha = false
            if (enableCaptcha) {
                if (captchaAfter <= 0) mustCaptcha = true
                else if ((rec?.fail_count ?? 0) >= captchaAfter) mustCaptcha = true
            }
            if (mustCaptcha) {
                if (!captcha || !captchaId) {
                    return (res as any).fail(CODES.AUTH_NEED_CAPTCHA, 400, '请先完成验证码', { error: { retryable: true } })
                }
                const ok = CaptchaService.verify(String(captchaId), String(captcha))
                if (!ok) {
                    const next = await lockSvc.hitFail(email, ip)
                    if (next >= lockAfter) {
                        const { untilMs, remainSec } = await lockSvc.lock(email, ip, lockMinutes, next)
                        const until = new Date(untilMs)
                        const ymd = `${until.getFullYear()}-${String(until.getMonth() + 1).padStart(2, '0')}-${String(until.getDate()).padStart(2, '0')}`
                        return (res as any).fail(CODES.AUTH_LOCKED, 423, '账号已临时锁定', {
                            error: { retryable: true },
                            subcode: SUBCODES.AUTH_LOCKED,
                            meta: { lockMinutes },
                            headers: { 'Retry-After': String(remainSec) },
                            data: { unlockAt: untilMs, remainingSec: remainSec, unlockDate: ymd },
                        })
                    }
                    return (res as any).badRequest('验证码错误或已过期', {
                        code: CODES.AUTH_BAD_CREDENTIALS,
                        error: { retryable: true },
                    })
                }
            }

            // —— 2) 凭证校验 —— //
            try {
                const { token, refresh, user, persist } = await svc.login(
                    email,
                    password,
                    { ip, ua: req.get('User-Agent') || undefined },
                    { persist: !!keep7Days }
                )
                await lockSvc.reset(email, ip) // 成功清零
                svc.setRefreshCookie(res, refresh, { persist })
                return (res as any).ok({ token, user }, '登录成功')
            } catch (e: any) {
                const next = await lockSvc.hitFail(email, ip)
                if (next >= lockAfter) {
                    const { untilMs, remainSec } = await lockSvc.lock(email, ip, lockMinutes, next)
                    const until = new Date(untilMs)
                    const ymd = `${until.getFullYear()}-${String(until.getMonth() + 1).padStart(2, '0')}-${String(until.getDate()).padStart(2, '0')}`
                    return (res as any).fail(
                        CODES.AUTH_LOCKED,
                        423,
                        `密码连续错误过多，账号已锁定 ${lockMinutes} 分钟`,
                        {
                            error: { retryable: true },
                            subcode: SUBCODES.AUTH_LOCKED,
                            meta: { lockMinutes },
                            headers: { 'Retry-After': String(remainSec) },
                            data: { unlockAt: untilMs, remainingSec: remainSec, unlockDate: ymd },
                        }
                    )
                }
                const msg = e?.message || '登录失败'
                const isForbidden = /禁用|停用/.test(msg)
                return (res as any)[isForbidden ? 'forbidden' : 'unauthorized'](
                    isForbidden ? '账号已被禁用' : '用户名或密码错误',
                    { code: CODES.AUTH_BAD_CREDENTIALS, error: { retryable: true } }
                )
            }
        } catch (e: any) {
            return (res as any).internal(e?.message || '登录失败')
        }
    }

    /** 刷新 */
    static async refresh(req: AuthRequest, res: Response<ApiResponse<{ token: string }>>) {
        try {
            const rt = (req as any)?.cookies?.rt || req.body?.refresh_token || req.get('x-refresh-token')
            if (!rt) return (res as any).unauthorized('缺少刷新令牌', { code: CODES.AUTH_UNAUTHORIZED })
            const { token, refresh, persist, remainMs } = await svc.refresh(rt)
            svc.setRefreshCookie(res as any, refresh, { persist, maxAgeMs: remainMs })
            return (res as any).ok({ token }, '刷新成功')
        } catch (e: any) {
            return (res as any).unauthorized(e?.message || '刷新失败，请重新登录', { code: CODES.AUTH_UNAUTHORIZED })
        }
    }

    /** 登出 */
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
