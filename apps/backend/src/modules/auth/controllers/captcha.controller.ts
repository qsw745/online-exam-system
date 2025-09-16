// apps/backend/src/modules/auth/controllers/captcha.controller.ts
import type { Response, Request } from 'express'
import { CODES } from '@/types/response'
import CaptchaService from '../services/captcha.service'

export class CaptchaController {
    /** 返回 JSON：{ id, svg, ttl } —— 适合 fetch/XHR 渲染到 <div dangerouslySetInnerHTML> */
    static newJson(_req: Request, res: Response) {
        const { id, svg, ttl } = CaptchaService.create()
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
        return (res as any).ok({ id, svg, ttl }, '验证码生成成功')
    }

    /** 直接返回图片流（SVG）—— 适合 <img src="/api/captcha/new"> */
    static newSvg(_req: Request, res: Response) {
        const { id, svg, ttl } = CaptchaService.create()
        res.setHeader('X-Captcha-Id', id)
        res.setHeader('X-Captcha-TTL', String(ttl))
        res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
        return res.status(200).send(svg)
    }

    /** POST /captcha/verify  { id, code }  -> { success: true/false } */
    static verify(req: Request, res: Response) {
        const { id, code } = (req.body || {}) as { id?: string; code?: string }
        const ok = CaptchaService.verify(id || '', code || '')
        if (!ok) return (res as any).badRequest('验证码不正确或已过期', { code: CODES.AUTH_NEED_CAPTCHA, error: { retryable: true } })
        return (res as any).ok(true, '验证码通过')
    }
}

export default CaptchaController
