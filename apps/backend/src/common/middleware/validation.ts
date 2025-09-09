// apps/backend/src/common/middleware/validation.ts
import type { NextFunction, Request, Response } from 'express'
import { validationResult } from 'express-validator'

/** 统一校验 express-validator 的结果 */
export function validateRequest(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req)
  if (errors.isEmpty()) return next()
  return res.status(400).json({
    success: false,
    error: '参数校验失败',
    details: errors.array().map(e => ({ field: e.param, message: e.msg, location: e.location, value: e.value })),
  })
}
