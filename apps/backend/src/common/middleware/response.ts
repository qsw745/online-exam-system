/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response, NextFunction } from 'express'
import { CODES, SUBCODES } from '@/types/response'

type Extra = {
    code?: string
    subcode?: number
    meta?: Record<string, any>
    links?: Record<string, string>
    error?: { details?: any; retryable?: boolean; docUrl?: string }
    headers?: Record<string, string>
}

function nowIso() {
    return new Date().toISOString()
}

function getDurationMs(res: Response) {
    const start = (res as any).__res_start_hrtime
    try {
        if (typeof start === 'bigint' && (process as any)?.hrtime?.bigint) {
            const ns = (process as any).hrtime.bigint() - start
            return Number(ns / BigInt(1_000_000))
        }
        if ((process as any)?.hrtime && start) {
            const diff = (process as any).hrtime(start)
            return Math.round(diff[0] * 1e3 + diff[1] / 1e6)
        }
    } catch {}
    return undefined
}

function requestIdOf(req: Request): string {
    return (req as any).id || (req.headers['x-request-id'] as string) || ''
}

function attachStart(res: Response) {
    try {
        if ((process as any)?.hrtime?.bigint) {
            ;(res as any).__res_start_hrtime = (process as any).hrtime.bigint()
        } else if ((process as any)?.hrtime) {
            ;(res as any).__res_start_hrtime = (process as any).hrtime()
        }
    } catch {}
}

/** 统一响应中间件：给 res 挂载 ok/created/fail/badRequest/unauthorized/forbidden/internal 等方法 */
export function responseEnvelope() {
    return function (req: Request, res: Response, next: NextFunction) {
        attachStart(res)

        function send(
            status: number,
            code: string,
            data: any,
            message?: string,
            extra?: Extra
        ) {
            if (extra?.headers) {
                for (const [k, v] of Object.entries(extra.headers)) res.setHeader(k, v as any)
            }
            const body: any = {
                success: status < 400,
                code,
                status,
                subcode: extra?.subcode,
                message,
                data: status < 400 ? (data ?? null) : undefined,
                error: status >= 400 ? (extra?.error ?? { details: data }) : undefined,
                meta: extra?.meta,
                links: extra?.links,
                trace: {
                    requestId: requestIdOf(req),
                    timestamp: nowIso(),
                    durationMs: getDurationMs(res),
                },
            }
            return res.status(status).json(body)
        }

        // —— 成功类 —— //
        ;(res as any).ok = (data?: any, message?: string, extra?: Extra) =>
            send(200, extra?.code ?? CODES.OK, data, message ?? 'OK', extra)

        ;(res as any).created = (data?: any, message?: string, extra?: Extra) =>
            send(201, extra?.code ?? CODES.CREATED, data, message ?? 'Created', { ...extra, subcode: extra?.subcode ?? SUBCODES.CREATED })

        // —— 通用 fail（自定义 code/status）—— //
        ;(res as any).fail = (code: string, status = 400, message?: string, extra?: Extra) =>
            send(status, code, undefined, message ?? 'Bad Request', extra)

        // —— 常见 4xx/5xx 便捷方法 —— //
        ;(res as any).badRequest = (message?: string, extra?: Extra) =>
            send(400, extra?.code ?? CODES.VALIDATION_ERROR, undefined, message ?? 'Bad Request', { ...extra, subcode: extra?.subcode ?? SUBCODES.VALIDATION_ERROR })

        ;(res as any).unauthorized = (message?: string, extra?: Extra) =>
            send(401, extra?.code ?? CODES.AUTH_UNAUTHORIZED, undefined, message ?? 'Unauthorized', { ...extra, subcode: extra?.subcode ?? SUBCODES.AUTH_UNAUTHORIZED })

        ;(res as any).forbidden = (message?: string, extra?: Extra) =>
            send(403, extra?.code ?? CODES.AUTH_FORBIDDEN, undefined, message ?? 'Forbidden', { ...extra, subcode: extra?.subcode ?? SUBCODES.AUTH_FORBIDDEN })

        ;(res as any).tooMany = (message?: string, extra?: Extra) =>
            send(429, extra?.code ?? CODES.RATE_LIMITED, undefined, message ?? 'Too Many Requests', { ...extra, subcode: extra?.subcode ?? SUBCODES.RATE_LIMITED })

        ;(res as any).internal = (message?: string, extra?: Extra) =>
            send(500, extra?.code ?? CODES.INTERNAL_ERROR, undefined, message ?? 'Internal Server Error', { ...extra, subcode: extra?.subcode ?? SUBCODES.INTERNAL_ERROR })

        next()
    }
}
