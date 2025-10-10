/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AuthRequest } from '@/types/auth'
import { DiscussionRepository } from '../repositories/discussion.repository'

let RC: any = null
let RL: any = null
;(async () => {
  try {
    const mod: any = await import('@/common/redis/cache')
    RC = mod?.default ?? mod
  } catch {}
  try {
    const mod: any = await import('@/common/redis/lock')
    RL = mod?.default ?? mod
  } catch {}
})()

// 轻量同步哈希（FNV-1a 32bit），避免依赖 'crypto'
function hashHex(str: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    // 32bit 乘法：* 16777619
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)
  }
  // 转无符号
  return (h >>> 0).toString(16).padStart(8, '0')
}

async function setnxWithTTL(key: string, ttl: number) {
  // 优先用 lock 工具；否则降级到 cache 实现
  const withLock = RL?.withLock as undefined | ((k: string, ttl: number, fn: () => Promise<any>) => Promise<any>)
  if (withLock) {
    let first = false
    await withLock(`lock:${key}`, 2, async () => {
      const existed = await RC?.get?.(key)
      if (!existed) {
        await RC?.set?.(key, '1', ttl)
        first = true
      }
    })
    return first
  }
  const existed = await RC?.get?.(key)
  if (existed) return false
  await RC?.set?.(key, '1', ttl)
  return true
}

export class DiscussionsService {
  static buildViewerKey(req: AuthRequest): string {
    const uid = req.user?.id
    if (uid) return `u:${uid}`

    // 使用 req.get()，并对 headers 做兜底，避免 TS2551
    const xff = (req as any)?.get?.('x-forwarded-for') ?? (req as any)?.headers?.['x-forwarded-for']
    const ipHeader = Array.isArray(xff) ? xff[0] : (xff as string | undefined)
    const ip = ipHeader?.split(',')[0].trim() || ((req as any).ip ?? '')
    const ua = String((req as any)?.get?.('user-agent') ?? (req as any)?.headers?.['user-agent'] ?? '')
    const raw = `${ip}|${ua}`
    const h = hashHex(raw)
    return `g:${h}`
  }

  /** 在 TTL 内确保只 +1 一次；true 表示这次应当 +1 */
  static async ensureViewOnce(req: AuthRequest, discussionId: number, ttlSeconds = 600): Promise<boolean> {
    const key = this.buildViewerKey(req)
    if (typeof DiscussionRepository.acquireViewLock === 'function') {
      return DiscussionRepository.acquireViewLock(discussionId, key, ttlSeconds)
    }
    return setnxWithTTL(`view:${discussionId}:${key}`, ttlSeconds)
  }

  static async markAsSolution(replyId: number, discussionId: number, userId: number): Promise<boolean> {
    const owner = await DiscussionRepository.findOwner(discussionId)
    if (!owner || owner.user_id !== userId) return false

    await DiscussionRepository.clearSolutions(discussionId)
    const ok = await DiscussionRepository.markReplyAsSolution(replyId, discussionId)
    if (!ok) return false

    const replyAuthorId = await DiscussionRepository.getReplyAuthorId(replyId)
    if (replyAuthorId) await DiscussionRepository.incUserSolutionStats(replyAuthorId)
    return true
  }

  static async togglePin(discussionId: number, userId: number): Promise<boolean> {
    if (!(await DiscussionRepository.isAdmin(userId))) return false
    await DiscussionRepository.togglePin(discussionId)
    return true
  }

  static async toggleLock(discussionId: number, userId: number): Promise<boolean> {
    if (!(await DiscussionRepository.isAdmin(userId))) return false
    await DiscussionRepository.toggleLock(discussionId)
    return true
  }

  static async toggleFeatured(discussionId: number, userId: number): Promise<boolean> {
    if (!(await DiscussionRepository.isAdmin(userId))) return false
    await DiscussionRepository.toggleFeatured(discussionId)
    return true
  }

  static async toggleFollow(discussionId: number, userId: number): Promise<{ is_followed: boolean }> {
    return DiscussionRepository.toggleFollow(userId, discussionId)
  }

  static async reportContent(
    userId: number,
    targetType: 'discussion' | 'reply',
    targetId: number,
    reason: string,
    description?: string
  ): Promise<boolean> {
    return DiscussionRepository.reportContent(userId, targetType, targetId, reason, description)
  }
}
