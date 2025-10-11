/* eslint-disable @typescript-eslint/no-explicit-any */
import { CODES, SUBCODES } from '@/types/response'
import type { NextFunction, Request, Response } from 'express'

type Extra = {
  code?: string
  subcode?: number
  meta?: Record<string, any>
  links?: Record<string, string>
  error?: { details?: any; retryable?: boolean; docUrl?: string }
  headers?: Record<string, string>
  data?: any
}

function nowIso() {
  return new Date().toISOString()
}

// ✅ 不直接访问 req.headers，改用 req.get()，避免类型告警
function requestIdOf(req: Request): string {
  const anyReq = req as any
  return anyReq.id || anyReq.requestId || (req.get('x-request-id') as string) || ''
}

function attachStart(res: Response) {
  const p: any = process
  try {
    if (p?.hrtime?.bigint) (res as any).__res_start_hrtime = p.hrtime.bigint()
    else if (p?.hrtime) (res as any).__res_start_hrtime = p.hrtime()
  } catch {}
}
function getDurationMs(res: Response) {
  const p: any = process
  const start = (res as any).__res_start_hrtime
  try {
    if (typeof start === 'bigint' && p?.hrtime?.bigint) {
      const ns = p.hrtime.bigint() - start
      return Number(ns / BigInt(1_000_000))
    }
    if (p?.hrtime && start) {
      const diff = p.hrtime(start)
      return Math.round(diff[0] * 1e3 + diff[1] / 1e6)
    }
  } catch {}
  return undefined
}

export function responseEnvelope() {
  return function (req: Request, res: Response, next: NextFunction) {
    attachStart(res)

    const send = (status: number, code: string, data: any, message?: string, extra?: Extra) => {
      // ✅ 用 res.set(...) 填充额外响应头
      if (extra?.headers) for (const [k, v] of Object.entries(extra.headers)) res.set(k, v as any)
      const isOk = status < 400
      const body: any = {
        success: isOk,
        code,
        status,
        subcode: extra?.subcode,
        message,
        data: isOk ? data ?? null : (extra as any)?.data ?? undefined,
        error: isOk ? undefined : extra?.error ?? { details: data },
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

    ;(res as any).ok = (data?: any, message?: string, extra?: Extra) =>
      send(200, extra?.code ?? CODES.OK, data, message ?? 'OK', extra)
    ;(res as any).created = (data?: any, message?: string, extra?: Extra) =>
      send(201, extra?.code ?? CODES.CREATED, data, message ?? 'Created', {
        ...extra,
        subcode: extra?.subcode ?? SUBCODES.CREATED,
      })
    ;(res as any).badRequest = (message?: string, extra?: Extra) =>
      send(400, extra?.code ?? CODES.VALIDATION_ERROR, undefined, message ?? 'Bad Request', {
        ...extra,
        subcode: extra?.subcode ?? SUBCODES.VALIDATION_ERROR,
      })
    ;(res as any).unauthorized = (message?: string, extra?: Extra) =>
      send(401, extra?.code ?? CODES.AUTH_UNAUTHORIZED, undefined, message ?? 'Unauthorized', {
        ...extra,
        subcode: extra?.subcode ?? SUBCODES.AUTH_UNAUTHORIZED,
      })
    ;(res as any).forbidden = (message?: string, extra?: Extra) =>
      send(403, extra?.code ?? CODES.AUTH_FORBIDDEN, undefined, message ?? 'Forbidden', {
        ...extra,
        subcode: extra?.subcode ?? SUBCODES.AUTH_FORBIDDEN,
      })
    ;(res as any).notFound = (message?: string, extra?: Extra) =>
      send(404, extra?.code ?? CODES.NOT_FOUND, undefined, message ?? 'Not Found', {
        ...extra,
        subcode: extra?.subcode ?? (SUBCODES as any)?.NOT_FOUND,
      })
    ;(res as any).tooMany = (message?: string, extra?: Extra) =>
      send(429, extra?.code ?? CODES.RATE_LIMITED, undefined, message ?? 'Too Many Requests', {
        ...extra,
        subcode: extra?.subcode ?? SUBCODES.RATE_LIMITED,
      })
    ;(res as any).internal = (message?: string, extra?: Extra) =>
      send(500, extra?.code ?? CODES.INTERNAL_ERROR, undefined, message ?? 'Internal Server Error', {
        ...extra,
        subcode: extra?.subcode ?? SUBCODES.INTERNAL_ERROR,
      })
    ;(res as any).conflict = (message?: string, extra?: Extra) =>
      send(409, extra?.code ?? (CODES as any)?.CONFLICT ?? 'CONFLICT', undefined, message ?? 'Conflict', {
        ...extra,
        subcode: extra?.subcode ?? (SUBCODES as any)?.CONFLICT,
      })
    ;(res as any).fail = (code: string, httpStatus = 400, message?: string, extra?: Extra) =>
      send(httpStatus, code, undefined, message ?? 'Bad Request', extra)

    next()
  }
}
