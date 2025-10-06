import type { NextFunction, Request, Response } from 'express'
import { validationResult } from 'express-validator'
import { CODES } from '@/types/response'

/** 统一校验 express-validator 的结果（兼容 v7 的错误结构） */
export function validateRequest(req: Request, res: Response, next: NextFunction) {
    const result = validationResult(req)
    if (result.isEmpty()) return next()

    const errors = result.array({ onlyFirstError: true }).map((e: any) => ({
        field: e.path ?? e.param ?? undefined,
        message: e.msg,
        location: e.location ?? e.type ?? 'body',
        value: e.value
    }))

    return (res as any).fail?.(CODES.VALIDATION_ERROR, 422, '参数校验失败', { data: { errors } }) ??
        res.status(422).json({ success: false, code: CODES.VALIDATION_ERROR, message: '参数校验失败', data: { errors } })
}
