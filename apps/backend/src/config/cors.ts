const NATIVE_APP_ORIGINS = [
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost',
  'https://localhost',
] as const

function normalizeOrigin(value: string) {
  return value.trim().replace(/\/$/, '')
}

export function buildAllowedCorsOrigins(frontendUrl?: string) {
  const configured = String(frontendUrl || 'http://localhost:5173')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean)

  return Array.from(new Set([...configured, ...NATIVE_APP_ORIGINS]))
}

/**
 * `cors` uses `false` to omit CORS headers for an untrusted browser origin.
 * Requests without an Origin header are non-browser/server-to-server calls.
 */
export function resolveCorsOrigin(requestOrigin: string | undefined, allowedOrigins: string[]) {
  if (!requestOrigin) return true
  return allowedOrigins.includes(normalizeOrigin(requestOrigin)) ? requestOrigin : false
}
