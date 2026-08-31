const SENSITIVE_LOG_KEYS = new Set([
  'password',
  'currentpassword',
  'oldpassword',
  'newpassword',
  'statustoken',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
  'set-cookie',
  'confirmationphrase',
  'email',
  'phone',
  'secret',
  'clientsecret',
])

export function redactSensitiveFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitiveFields)
  if (value instanceof Date) return value.toISOString()
  if (Buffer.isBuffer(value)) return '[REDACTED_BINARY]'
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_LOG_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : redactSensitiveFields(item),
    ]),
  )
}

export function redactSensitiveText(value: unknown): string {
  return String(value ?? '')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]')
    .replace(/(?<![A-Za-z0-9])(?:\+?\d[\d -]{7,}\d)(?![A-Za-z0-9])/g, '[REDACTED_PHONE]')
    .replace(/\b[A-Za-z0-9_-]{43}\b/g, '[REDACTED_TOKEN]')
}

export type SafeSqlErrorMetadata = {
  code?: string
  errno?: number
  sqlState?: string
  sqlMessage?: string
}

export function sanitizeSqlErrorMetadata(error: unknown): SafeSqlErrorMetadata | undefined {
  if (!error || typeof error !== 'object') return undefined
  const row = error as Record<string, unknown>
  const code = typeof row.code === 'string' ? row.code : undefined
  const errno = typeof row.errno === 'number' ? row.errno : undefined
  const sqlStateValue = row.sqlState ?? row.sqlstate
  const sqlState = typeof sqlStateValue === 'string' ? sqlStateValue : undefined
  const sqlMessageValue = row.sqlMessage ?? row.message
  const sqlMessage = typeof sqlMessageValue === 'string' ? redactSensitiveText(sqlMessageValue) : undefined
  if (code === undefined && errno === undefined && sqlState === undefined && sqlMessage === undefined) return undefined
  return { code, errno, sqlState, sqlMessage }
}
