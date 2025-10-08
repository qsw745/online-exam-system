// apps/backend/src/common/redis/lock.ts
import { redis } from './client'

/** 分布式短锁：SET key NX EX ttlSec */
export async function withLock<T>(key: string, ttlSec: number, fn: () => Promise<T>): Promise<T> {
  const ok = await tryAcquire(key, ttlSec)
  if (!ok) throw new Error('LOCK_BUSY')
  try {
    return await fn()
  } finally {
    // 让 TTL 自然过期；若需提前释放应使用 token 模式
  }
}

async function tryAcquire(key: string, ttlSec: number): Promise<boolean> {
  try {
    // ioredis v5：使用 options 对象，避免重载类型不匹配
    const res = await redis.set(key, '1', { EX: ttlSec, NX: true } as any)
    return res === 'OK'
  } catch {
    return false
  }
}

export default { withLock }
