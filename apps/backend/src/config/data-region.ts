import { normalizeDataRegion, type DataRegion } from '@/modules/auth/domain/account-region.policy'

export function resolveServiceDataRegion(value: unknown, nodeEnv = process.env.NODE_ENV): DataRegion | null {
  const raw = String(value ?? '').trim()
  if (!raw && nodeEnv !== 'production') return null
  const region = normalizeDataRegion(raw)
  if (!region) throw new Error('SERVICE_DATA_REGION must be CN or GLOBAL')
  return region
}

export function getServiceDataRegion(): DataRegion | null {
  return resolveServiceDataRegion(process.env.SERVICE_DATA_REGION, process.env.NODE_ENV)
}
