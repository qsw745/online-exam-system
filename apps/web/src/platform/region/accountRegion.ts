export type DataRegion = 'CN' | 'GLOBAL'

const configuredRegions = String(import.meta.env.VITE_ENABLED_DATA_REGIONS || 'CN,GLOBAL').split(',')
export const enabledDataRegions: DataRegion[] = (['CN', 'GLOBAL'] as const).filter(region => configuredRegions.includes(region))
if (!enabledDataRegions.length) throw new Error('No enabled data regions')

export const PREFERRED_DATA_REGION_KEY = 'wenheng_data_region'

type ReadStorage = Pick<Storage, 'getItem'>
type WriteStorage = Pick<Storage, 'setItem'>

function defaultReadStorage(): ReadStorage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage
}

function defaultWriteStorage(): WriteStorage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage
}

export function normalizeDataRegion(value: unknown): DataRegion | null {
  const normalized = String(value ?? '').trim().toUpperCase()
  return normalized === 'CN' || normalized === 'GLOBAL' ? normalized : null
}

export function readPreferredDataRegion(storage: ReadStorage | undefined = defaultReadStorage()): DataRegion {
  try {
    const stored = normalizeDataRegion(storage?.getItem(PREFERRED_DATA_REGION_KEY))
    return stored && enabledDataRegions.includes(stored) ? stored : enabledDataRegions[0]
  } catch {
    return enabledDataRegions[0]
  }
}

export function writePreferredDataRegion(
  regionValue: DataRegion,
  storage: WriteStorage | undefined = defaultWriteStorage(),
): void {
  const region = normalizeDataRegion(regionValue)
  if (!region) throw new Error('Unsupported data region')
  storage?.setItem(PREFERRED_DATA_REGION_KEY, region)
}

function trimUrl(value: unknown): string {
  return String(value ?? '').trim().replace(/\/+$/, '')
}

export function resolveRegionalApiBaseUrl(
  region: DataRegion,
  urls: { defaultUrl?: string; cnUrl?: string; globalUrl?: string },
): string {
  const regional = region === 'CN' ? trimUrl(urls.cnUrl) : trimUrl(urls.globalUrl)
  return regional || trimUrl(urls.defaultUrl) || '/api'
}
