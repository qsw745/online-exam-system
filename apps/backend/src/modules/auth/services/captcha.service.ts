// src/modules/auth/services/captcha.service.ts
import svgCaptcha from 'svg-captcha'
import { redis } from '@/common/redis/client'

const TTL_SEC = 3 * 60
const COOLDOWN_SEC = 2 // 可选：同 IP 连续取码间隔（秒）

const K = {
  cap: (id: string) => `captcha:${id}`, // 保存答案
  bind: (id: string) => `captcha:bind:${id}`, // 绑定 IP
  cd: (ip: string) => `captcha:cd:${ip}`, // 取码微冷却
}

// 一次性 GET&DEL 的 Lua（命中返回值并删除，未命中返回 nil）
const LUA_GETDEL = `
  local v = redis.call('GET', KEYS[1])
  if v then redis.call('DEL', KEYS[1]) end
  return v
`

function randId() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
}

export const CaptchaService = {
  /**（推荐）按 IP 生成，并绑定 IP；带 2 秒微冷却（避免极端 QPS 抖动） */
  async createFor(ip?: string) {
    // 微冷却（不替代上层限流，仅作为细粒度保护）
    if (ip) {
      const set = await redis.setnx(K.cd(ip), '1')
      if (set) await redis.expire(K.cd(ip), COOLDOWN_SEC)
      // 若 set==0 表示冷却键已存在；这里不抛错，由上层 rateLimit 统一控制
    }

    const { text, data } = svgCaptcha.create({
      width: 120,
      height: 44,
      size: 4,
      noise: 2,
      ignoreChars: '0oO1ilI',
      color: true,
      background: '#f6f7fb',
    })
    const id = randId()
    const ans = (text || '').toLowerCase()

    // 保存答案 + 绑定 IP（同 TTL）
    const tasks: Promise<unknown>[] = [redis.set(K.cap(id), ans, 'EX', TTL_SEC).catch(() => {})]
    if (ip) tasks.push(redis.set(K.bind(id), ip, 'EX', TTL_SEC).catch(() => {}))
    await Promise.all(tasks)

    return { id, svg: data, ttl: TTL_SEC * 1000 }
  },

  /** 兼容旧用法：不绑定 IP 的创建 */
  async create() {
    return this.createFor(undefined)
  },

  /** 一次性校验 + IP 绑定校验（成功或失败都会清除答案；绑定记录也一并清理） */
  async verifyBound(id: string, input: string, ip?: string) {
    if (!id || !input) return false

    // 如有绑定，则要求同 IP 使用
    if (ip) {
      const boundIp = await redis.get(K.bind(id))
      if (boundIp && boundIp !== ip) {
        await Promise.allSettled([redis.del(K.cap(id)), redis.del(K.bind(id))])
        return false
      }
    }

    const saved = await redis.eval(LUA_GETDEL as any, 1, K.cap(id))
    await redis.del(K.bind(id)).catch(() => {}) // 清理绑定关系

    if (!saved) return false
    return String(saved).toLowerCase() === String(input).trim().toLowerCase()
  },

  /** 旧接口：仅校验，不核对 IP（仍然是一次性） */
  async verify(id: string, input: string) {
    if (!id || !input) return false
    const saved = await redis.eval(LUA_GETDEL as any, 1, K.cap(id))
    if (!saved) return false
    return String(saved).toLowerCase() === String(input).trim().toLowerCase()
  },
}

export default CaptchaService
