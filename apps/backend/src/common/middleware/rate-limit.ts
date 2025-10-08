// src/common/middleware/rate-limit.ts
import type { Request, Response, NextFunction } from 'express'
import { redis } from '@/common/redis/client'

type RateLimitOptions = {
  keyBuilder: (req: Request) => string
  limit: number
  windowSec: number
  /** 可选：超限后临时封禁多少秒；不传则只按窗口 TTL 提示 */
  blockDurationSec?: number
}

export function rateLimit({ keyBuilder, limit, windowSec, blockDurationSec }: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = keyBuilder(req)
    const blockKey = `${key}:block`

    // 若处于封禁期，直接返回 429
    const blockedTtl = await redis.ttl(blockKey)
    if (blockedTtl > 0) {
      res.setHeader('Retry-After', String(Math.max(1, blockedTtl)))
      return res.status(429).json({ success: false, message: '请求过于频繁，请稍后再试' })
    }

    // 计数窗口
    const cur = await redis.incr(key)
    if (cur === 1) await redis.expire(key, windowSec)

    if (cur > limit) {
      if (blockDurationSec && blockDurationSec > 0) {
        // 设置封禁键（只在不存在时设置，避免缩短已有封禁 TTL）
        const set = await redis.setnx(blockKey, '1')
        if (set) await redis.expire(blockKey, blockDurationSec)
        const ttl = await redis.ttl(blockKey)
        res.setHeader('Retry-After', String(Math.max(1, ttl)))
      } else {
        const ttl = await redis.ttl(key)
        res.setHeader('Retry-After', String(Math.max(1, ttl)))
      }
      return res.status(429).json({ success: false, message: '请求过于频繁，请稍后再试' })
    }

    next()
  }
}

/**
 * 使用示例（登录接口）
 * app.post('/api/auth/login',
 *   rateLimit({ keyBuilder: r => `rl:ip:${r.ip}:login`, limit: 5, windowSec: 60 }),
 *   loginHandler
 * )
 */
