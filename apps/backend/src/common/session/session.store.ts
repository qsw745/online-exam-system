/* 最小可用的会话存储（带日志/前缀/检测）：优先 Redis（ioredis），否则内存降级 */
import crypto from 'node:crypto'
import { any } from 'zod'

type SessionRow = {
  jti: string
  userId: number
  username?: string
  role?: string
  ip?: string | null
  ua?: string | null
  loginAt: string // ISO
  expAt: number // unix seconds
}

const nowSec = () => Math.floor(Date.now() / 1000)
const ttlFromExp = (exp: number) => Math.max(1, exp - nowSec())

// ---- 读取环境变量 ----
const REDIS_URL = process.env.REDIS_URL || ''
const PREFIX = (process.env.REDIS_PREFIX ? String(process.env.REDIS_PREFIX) : '').replace(/:+$/, '')
const keyPfx = PREFIX ? `${PREFIX}:` : ''

// ---- 可能的 Redis 客户端 ----
let redis: any = null
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Redis = require('ioredis')
  if (REDIS_URL) {
    // 可选：retry 策略 + keyPrefix（注意：用了 keyPrefix 后，命令里就不要再手动拼 prefix 了）
    redis = new Redis(REDIS_URL, {
      retryStrategy: (times : any) => Math.min(times * 200, 2000),
      // 如果你想通过 ioredis 的 keyPrefix 统一加前缀，就把下面一行打开，同时把 KEYS 里的 keyPfx 去掉
      // keyPrefix: keyPfx,
    })
    redis.on('connect', () => console.log(`[redis] connecting ${REDIS_URL}`))
    redis.on('ready', () => console.log('[redis] ready'))
    redis.on('error', (e: any) => console.error('[redis] error:', e?.message || e))
    redis.on('end', () => console.warn('[redis] connection closed'))
    redis.on('reconnecting', () => console.log('[redis] reconnecting...'))
  } else {
    console.warn('[redis] REDIS_URL 未设置，使用内存会话存储（开发模式可用，生产不推荐）')
  }
} catch (e: any) {
  console.warn('[redis] 未安装 ioredis 或加载失败，使用内存会话存储。', e?.message || e)
}

// ---- 内存降级存储 ----
const mem = {
  byId: new Map<string, SessionRow>(),
  kicked: new Set<string>(),
}

// ---- key 生成（未使用 ioredis 的 keyPrefix 时拼上自定义前缀）----
const KEYS = {
  sess: (jti: string) => `${keyPfx}sess:${jti}`,
  kicked: (jti: string) => `${keyPfx}kicked:${jti}`,
  setAll: `${keyPfx}sess:all`,
}

export const SessionStore = {
  /** 生成 jti */
  newJti() {
    return crypto.randomUUID()
  },

  /** 主动检查连接（用于启动自检/诊断） */
  async ping(): Promise<boolean> {
    if (!redis) return false
    try {
      const p = await redis.ping()
      return p === 'PONG'
    } catch {
      return false
    }
  },

  /** 保存会话（TTL=exp-iat） */
  async save(row: SessionRow) {
    if (redis) {
      const key = KEYS.sess(row.jti)
      const ttl = ttlFromExp(row.expAt)
      await redis.set(key, JSON.stringify(row), 'EX', ttl)
      await redis.sadd(KEYS.setAll, row.jti)
      await redis.expire(KEYS.setAll, Math.max(ttl, 3600))
      return
    }
    mem.byId.set(row.jti, row)
  },

  /** 标记强退/作废 */
  async revoke(jti: string) {
    if (redis) {
      const key = KEYS.sess(jti)
      const kickedKey = KEYS.kicked(jti)
      const raw = await redis.get(key)
      if (raw) {
        const row: SessionRow = JSON.parse(raw)
        const ttl = ttlFromExp(row.expAt)
        await redis.set(kickedKey, '1', 'EX', ttl)
      } else {
        // 即使会话已不存在，也可短暂标记，阻止极端竞态
        await redis.set(kickedKey, '1', 'EX', 60)
      }
      await redis.del(key)
      await redis.srem(KEYS.setAll, jti)
      return
    }
    mem.byId.delete(jti)
    mem.kicked.add(jti)
  },

  /** 鉴权时检查：存在 & 未被强退 & 未过期 */
  async isActive(jti: string) {
    if (!jti) return false
    if (redis) {
      const kicked = await redis.get(KEYS.kicked(jti))
      if (kicked) return false
      const raw = await redis.get(KEYS.sess(jti))
      if (!raw) return false
      const row: SessionRow = JSON.parse(raw)
      return row.expAt > nowSec()
    }
    if (mem.kicked.has(jti)) return false
    const row = mem.byId.get(jti)
    return !!row && row.expAt > nowSec()
  },

  /** 在线会话列表（仅当前还有效的） */
  async listActive(): Promise<SessionRow[]> {
    const out: SessionRow[] = []
    if (redis) {
      const all: string[] = await redis.smembers(KEYS.setAll)
      if (!all?.length) return out
      const keys = all.map(KEYS.sess)
      const raws: (string | null)[] = await redis.mget(keys)
      for (const raw of raws) {
        if (!raw) continue
        const row: SessionRow = JSON.parse(raw)
        if (row.expAt > nowSec()) out.push(row)
      }
      return out.sort((a, b) => (a.loginAt < b.loginAt ? 1 : -1))
    }
    mem.byId.forEach(v => {
      if (v.expAt > nowSec()) out.push(v)
    })
    return out.sort((a, b) => (a.loginAt < b.loginAt ? 1 : -1))
  },
}

export type { SessionRow }
