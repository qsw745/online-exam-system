import { ProfileRepository } from '../repositories/profile.repository.js'
import type { ProfileDTO, UpdateProfilePayload } from '../domain/profile.model'
let RC: any = null
;(async () => {
  try {
    RC = (await import('@/common/redis/cache')).default || (await import('@/common/redis/cache'))
  } catch {}
})()
const PROFILE_TTL = 600
const kProf = (uid: number) => `profile:${uid}`
async function cget<T = any>(k: string) {
  try {
    const v = await RC?.get?.(k)
    return v ? JSON.parse(v) : null
  } catch {
    return null
  }
}
async function cset(k: string, v: any, ttl = PROFILE_TTL) {
  try {
    await RC?.set?.(k, JSON.stringify(v), ttl)
  } catch {}
}
async function cdel(...ks: string[]) {
  try {
    for (const k of ks) await RC?.del?.(k)
  } catch {}
}

export class ProfileService {
  static async get(userId: number) {
    const ck = kProf(userId)
    const hit = await cget<ProfileDTO>(ck)
    if (hit) return hit
    const row = await ProfileRepository.getByUserId(userId)
    if (row) await cset(ck, row, 600)
    return row
  }
  static async update(userId: number, payload: UpdateProfilePayload) {
    const r = await ProfileRepository.update(userId, payload)
    await cdel(kProf(userId))
    return r
  }
  static async updateAvatar(userId: number, value: string) {
    const r = await ProfileRepository.updateAvatar(userId, value)
    await cdel(kProf(userId))
    return r
  }
}
