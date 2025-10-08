/* eslint-disable @typescript-eslint/no-explicit-any */
import { redis } from '@/common/redis/client'
import { LoginFailureRepository } from '@/modules/auth/repositories/login-failure.repository'

const K = {
  fail: (email: string, ip: string) => `auth:fail:${email}:${ip}`,
  lock: (email: string, ip: string) => `auth:lock:${email}:${ip}`,
}

export class AuthLockService {
  constructor(private minutes: number) {}

  /** 读取 Redis 快路径；DB 作为兜底 */
  async getRecord(email: string, ip: string) {
    const [failStr, lockUntilStr] = await redis
      .multi()
      .get(K.fail(email, ip))
      .get(K.lock(email, ip))
      .exec()
      .then(r => [r?.[0]?.[1] as string | null, r?.[1]?.[1] as string | null])

    if (failStr || lockUntilStr) {
      const fail_count = Number(failStr || 0)
      const lu = lockUntilStr ? Number(lockUntilStr) : 0
      return lu > Date.now()
        ? { fail_count, locked_until: new Date(lu).toISOString() }
        : { fail_count, locked_until: null }
    }
    // 兜底查库（兼容历史数据）
    return LoginFailureRepository.get(email, ip)
  }

  /** 锁过期自动解锁并清零失败计数（同步 Redis & DB） */
  async unlockIfExpired(email: string, ip: string) {
    const lu = await redis.get(K.lock(email, ip))
    if (lu && Number(lu) <= Date.now()) {
      await redis.del(K.lock(email, ip))
      await redis.del(K.fail(email, ip))
      await LoginFailureRepository.reset(email, ip)
    }
  }

  /** 衰减：窗口外清零（Redis 直接用 TTL，不需要定时任务；DB 兼容） */
  async decayOldFails(email: string, ip: string, windowMinutes?: number) {
    // Redis 侧：fail key 本身设置 EX=窗口秒数，到期自动清零
    await LoginFailureRepository.decayIfStale(email, ip, windowMinutes ?? this.minutes)
  }

  /** 失败 +1，设置窗口 TTL */
  async hitFail(email: string, ip: string) {
    const ttl = Math.max(60, (this.minutes || 5) * 60)
    const cur = await redis.incr(K.fail(email, ip))
    if (cur === 1) await redis.expire(K.fail(email, ip), ttl) // 首次设置过期
    await LoginFailureRepository.increase(email, ip) // 异步跟 DB 同步计数
    return cur
  }

  async reset(email: string, ip: string) {
    await redis.del(K.fail(email, ip))
    await redis.del(K.lock(email, ip))
    await LoginFailureRepository.reset(email, ip)
  }

  /** 上锁：写锁定到期时间（毫秒时间戳），同时同步 DB 的 locked_until 与 fail_count */
  async lock(email: string, ip: string, minutes?: number, withCount?: number) {
    const ms = (typeof minutes === 'number' && minutes > 0 ? minutes : this.minutes) * 60 * 1000
    const untilMs = Date.now() + ms
    await redis.set(K.lock(email, ip), String(untilMs), 'PX', ms)
    if (typeof withCount === 'number') {
      // 让 fail 计数在锁期内保持
      await redis.set(K.fail(email, ip), String(withCount), 'PX', ms)
    }
    await LoginFailureRepository.lockWithCount(email, ip, new Date(untilMs), withCount)
    return { untilMs, remainSec: Math.ceil(ms / 1000) }
  }

  async isLocked(email: string, ip: string) {
    const lu = await redis.get(K.lock(email, ip))
    if (lu && Number(lu) > Date.now()) {
      const remainSec = Math.ceil((Number(lu) - Date.now()) / 1000)
      return { locked: true as const, untilMs: Number(lu), remainSec }
    }
    const rec = await LoginFailureRepository.get(email, ip)
    if (!rec?.locked_until) return { locked: false as const }
    const until = new Date(rec.locked_until).getTime()
    const remainSec = Math.max(0, Math.ceil((until - Date.now()) / 1000))
    return remainSec > 0 ? { locked: true as const, untilMs: until, remainSec } : { locked: false as const }
  }
}
