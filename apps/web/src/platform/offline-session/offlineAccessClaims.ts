import type { DataRegion } from '@/platform/region/accountRegion'

export type OfflineAccessClaims = {
  id: string
  email: string
  role: string
  public_id?: string
  data_region?: DataRegion
}

function decodePayload(token: string): Record<string, unknown> | null {
  try {
    const encoded = token.split('.')[1]
    if (!encoded) return null
    const padded = encoded.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(encoded.length / 4) * 4, '=')
    const bytes = atob(padded)
    const json = new TextDecoder().decode(Uint8Array.from(bytes, char => char.charCodeAt(0)))
    const value = JSON.parse(json)
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null
  } catch {
    return null
  }
}

export function decodeOfflineAccessClaims(token: string, nowMs = Date.now()): OfflineAccessClaims | null {
  const payload = decodePayload(token)
  if (!payload || payload.type !== 'access') return null
  if (!Number.isFinite(Number(payload.exp)) || Number(payload.exp) * 1000 <= nowMs) return null
  if (!Number.isFinite(Number(payload.id)) || Number(payload.id) <= 0) return null

  const roles = Array.isArray(payload.roles) ? payload.roles : []
  const role = roles
    .map(item => typeof item === 'string' ? item : item && typeof item === 'object' ? (item as any).code : null)
    .find(item => typeof item === 'string' && item.length > 0)
  if (!role) return null

  const dataRegion = payload.data_region === 'CN' || payload.data_region === 'GLOBAL'
    ? payload.data_region
    : undefined
  return {
    id: String(payload.id),
    email: typeof payload.email === 'string' ? payload.email : '',
    role,
    ...(typeof payload.public_id === 'string' ? { public_id: payload.public_id } : {}),
    ...(dataRegion ? { data_region: dataRegion } : {}),
  }
}
