// apps/backend/src/common/errors.ts
export class HttpError extends Error {
  status: number
  code?: string
  ctx?: Record<string, unknown>
  constructor(status: number, message: string, code?: string, ctx?: Record<string, unknown>) {
    super(message)
    this.name = this.constructor.name
    this.status = status
    this.code = code
    this.ctx = ctx
    Error.captureStackTrace?.(this, this.constructor)
  }
}

export const badRequest = (msg = 'Bad Request', ctx?: Record<string, unknown>) =>
  new HttpError(400, msg, 'BAD_REQUEST', ctx)
export const unauthorized = (msg = 'Unauthorized', ctx?: Record<string, unknown>) =>
  new HttpError(401, msg, 'UNAUTHORIZED', ctx)
export const forbidden = (msg = 'Forbidden', ctx?: Record<string, unknown>) => new HttpError(403, msg, 'FORBIDDEN', ctx)
export const notFound = (msg = 'Not Found', ctx?: Record<string, unknown>) => new HttpError(404, msg, 'NOT_FOUND', ctx)
export const internal = (msg = 'Internal Server Error', ctx?: Record<string, unknown>) =>
  new HttpError(500, msg, 'INTERNAL', ctx)
