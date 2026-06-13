// apps/backend/src/modules/admin-settings/services/admin-settings.service.ts
import { AdminSettingsRepository } from '../repositories/admin-settings.repository.js'
import type { SystemSettings } from '../domain/admin-settings.model'

let RC: any = null
;(async () => {
  try {
    const mod: any = await import('@/common/redis/cache')
    RC = mod?.default ?? mod
  } catch {}
})()

const SET_TTL = 600
const kSettings = 'settings:safe'

async function cget<T = any>(k: string) {
  try {
    const v = await RC?.get?.(k)
    return v ? JSON.parse(v) : null
  } catch {
    return null
  }
}
async function cset(k: string, v: any, ttl = SET_TTL) {
  try {
    await RC?.set?.(k, JSON.stringify(v), ttl)
  } catch {}
}
async function cdel(...ks: string[]) {
  try {
    for (const k of ks) await RC?.del?.(k)
  } catch {}
}

export class AdminSettingsService {
  static async getSafe(): Promise<SystemSettings> {
    const hit = await cget<SystemSettings>(kSettings)
    if (hit) return hit
    const data = await AdminSettingsRepository.get()
    const { defaultPassword, aiApiKey, ...safe } = data as any
    safe.aiApiKey = ''
    safe.aiApiKeySet = !!aiApiKey
    await cset(kSettings, safe, 600)
    return safe as SystemSettings
  }

  static async update(payload: Partial<SystemSettings>): Promise<void> {
    const next = { ...(payload as any) }
    if (typeof next.aiApiKey === 'string') {
      next.aiApiKey = next.aiApiKey.trim()
      if (!next.aiApiKey) delete next.aiApiKey
    }
    delete next.aiApiKeySet
    await AdminSettingsRepository.update(next)
    await cdel(kSettings) // 变更后失效
  }
}
