// apps/backend/src/common/errors/http-error.ts
export class HttpError extends Error {
  status: number
  code?: string
  details?: any
  ctx?: any

  constructor(message: string, status = 500, opts?: { code?: string; details?: any; ctx?: any }) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = opts?.code
    this.details = opts?.details
    this.ctx = opts?.ctx
    Error.captureStackTrace?.(this, HttpError)
  }

  static badRequest(message = 'Bad Request', details?: any) {
    return new HttpError(message, 400, { code: 'BAD_REQUEST', details })
  }
  static unauthorized(message = 'Unauthorized') {
    return new HttpError(message, 401, { code: 'UNAUTHORIZED' })
  }
  static forbidden(message = 'Forbidden') {
    return new HttpError(message, 403, { code: 'FORBIDDEN' })
  }
  static notFound(message = 'Not Found') {
    return new HttpError(message, 404, { code: 'NOT_FOUND' })
  }
  static internal(message = 'Internal Server Error', ctx?: any) {
    return new HttpError(message, 500, { code: 'INTERNAL', ctx })
  }
}

export class ValidationError extends HttpError {
  constructor(message = '请求参数验证失败', details?: string[]) {
    super(message, 400, { code: 'VALIDATION_FAILED', details })
    this.name = 'ValidationError'
    Error.captureStackTrace?.(this, ValidationError)
  }
}
