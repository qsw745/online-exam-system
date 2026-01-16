import crypto from 'crypto'
import { get as cacheGetRaw, set as cacheSetRaw } from '@/common/redis/cache'

export const AI_CACHE_PREFIX = 'ai:cache'

export const hashKey = (input: any) =>
  crypto
    .createHash('sha1')
    .update(typeof input === 'string' ? input : JSON.stringify(input))
    .digest('hex')

export const buildCacheKey = (scope: string, input: any) => `${AI_CACHE_PREFIX}:${scope}:${hashKey(input)}`

export async function cacheGet<T = any>(key: string): Promise<T | null> {
  try {
    const raw = await cacheGetRaw(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function cacheSet(key: string, value: any, ttlSec?: number): Promise<void> {
  try {
    await cacheSetRaw(key, JSON.stringify(value), ttlSec)
  } catch {}
}
