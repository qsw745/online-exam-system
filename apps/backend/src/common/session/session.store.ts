/* 最小可用的会话存储（Redis 优先，内存降级） */
import { redis } from '@/common/redis/client'

type SessionRow = {
  jti: string
  userId: number
  username?: string
  email?: string
  role?: string
  ip?: string | null
  ua?: string | null
  loginAt: string // ISO
  expAt: number // unix seconds
}

const nowSec = () => Math.floor(Date.now() / 1000)
const ttlFromExp = (exp: number) => Math.max(1, exp - nowSec())

function uuidLike(): string {
  const r = (n = 16) => [...Array(n)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')
  try {
    const g: any = (globalThis as any).crypto
    if (g?.randomUUID) return g.randomUUID()
  } catch {}
  return `${r(8)}-${r(4)}-${r(4)}-${r(4)}-${r(12)}`
}

const PREFIX = (process.env.REDIS_PREFIX ? String(process.env.REDIS_PREFIX) : '').replace(/:+$/, '')
const keyPfx = PREFIX ? `${PREFIX}:` : ''

const KEYS = {
  sess: (jti: string) => `${keyPfx}sess:${jti}`,
  kicked: (jti: string) => `${keyPfx}kicked:${jti}`,
  setAll: `${keyPfx}sess:all`,
}

// 内存降级
const mem = {
  byId: new Map<string, SessionRow>(),
  kicked: new Set<string>(),
}

export const SessionStore = {
  newJti() {
    return uuidLike()
  },

  async ping(): Promise<boolean> {
    try {
      const p = await redis.ping()
      return p === 'PONG'
    } catch {
      return false
    }
  },

  async save(row: SessionRow) {
    try {
      const key = KEYS.sess(row.jti)
      const ttl = ttlFromExp(row.expAt)
      await redis.set(key, JSON.stringify(row), 'EX', ttl)
      await redis.sadd(KEYS.setAll, row.jti)
      await redis.expire(KEYS.setAll, Math.max(ttl, 3600))
    } catch {
      mem.byId.set(row.jti, row)
    }
  },

  async revoke(jti: string) {
    try {
      const key = KEYS.sess(jti)
      const kickedKey = KEYS.kicked(jti)
      const raw = await redis.get(key)
      if (raw) {
        const row: SessionRow = JSON.parse(raw)
        const ttl = ttlFromExp(row.expAt)
        await redis.set(kickedKey, '1', 'EX', ttl)
      } else {
        await redis.set(kickedKey, '1', 'EX', 60)
      }
      await redis.del(key)
      await redis.srem(KEYS.setAll, jti)
    } catch {
      mem.byId.delete(jti)
      mem.kicked.add(jti)
    }
  },

  async isActive(jti: string) {
    if (!jti) return false
    try {
      const kicked = await redis.get(KEYS.kicked(jti))
      if (kicked) return false
      const raw = await redis.get(KEYS.sess(jti))
      if (!raw) return false
      const row: SessionRow = JSON.parse(raw)
      return row.expAt > nowSec()
    } catch {
      if (mem.kicked.has(jti)) return false
      const row = mem.byId.get(jti)
      return !!row && row.expAt > nowSec()
    }
  },

  async listActive(): Promise<SessionRow[]> {
    const out: SessionRow[] = []
    try {
      const all: string[] = await redis.smembers(KEYS.setAll)
      if (!all?.length) return out
      const keys = all.map(KEYS.sess)
      const raws = await redis.mget(keys)
      for (const raw of raws) {
        if (!raw) continue
        const row: SessionRow = JSON.parse(raw)
        if (row.expAt > nowSec()) out.push(row)
      }
      return out.sort((a, b) => (a.loginAt < b.loginAt ? 1 : -1))
    } catch {
      mem.byId.forEach(v => {
        if (v.expAt > nowSec()) out.push(v)
      })
      return out.sort((a, b) => (a.loginAt < b.loginAt ? 1 : -1))
    }
  },
}

export type { SessionRow }
