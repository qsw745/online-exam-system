// apps/backend/src/common/redis/cache.ts
import { redis } from './client'

// 统一的 Cache 包装：get/set/del/keys
async function get(key: string): Promise<string | null> {
  try {
    return await redis.get(key)
  } catch {
    return null
  }
}

async function set(key: string, value: string, ttlSec?: number): Promise<'OK' | null> {
  try {
    if (ttlSec && ttlSec > 0) {
      // ioredis 支持 ['EX', ttl]
      return (await redis.set(key, value, 'EX', ttlSec)) as any
    }
    return (await redis.set(key, value)) as any
  } catch {
    return null
  }
}

async function del(keys: string | string[]): Promise<number> {
  try {
    const list = Array.isArray(keys) ? keys : [keys]
    if (!list.length) return 0
    return await redis.del(...list)
  } catch {
    return 0
  }
}

async function keys(pattern: string): Promise<string[]> {
  try {
    return await redis.keys(pattern)
  } catch {
    return []
  }
}

async function expire(key: string, ttlSec: number): Promise<number> {
  try {
    return await redis.expire(key, ttlSec)
  } catch {
    return 0
  }
}

export { get, set, del, keys, expire }

// 也导出默认，便于动态导入 .default || mod
export default { get, set, del, keys, expire }
