import crypto from 'crypto'
import { redis } from '@/common/redis/client'
import { UserRepository } from '../repositories/user.repository'
import { emailService } from '@/infrastructure/email/email.service'

const TTL_SEC = 24 * 60 * 60 // 验证链接 24 小时有效
const keyOf = (token: string) => `verify:email:${token}`

export class EmailVerificationService {
  /** 生成验证 token、存 Redis、发送验证邮件 */
  static async issue(userId: number, email: string, username: string): Promise<void> {
    const token = crypto.randomBytes(32).toString('hex')
    await redis.set(keyOf(token), String(userId), 'EX', TTL_SEC)
    await emailService.sendVerificationEmail(email, token, username || email)
  }

  /** 校验 token（单次消费）→ 标记用户已验证 */
  static async verify(token: string): Promise<{ ok: boolean }> {
    const t = String(token || '').trim()
    if (!t) return { ok: false }
    const key = keyOf(t)
    const userId = await redis.get(key)
    if (!userId) return { ok: false }
    await redis.del(key)
    await UserRepository.markEmailVerified(Number(userId))
    return { ok: true }
  }

  /** 重新发送验证邮件（用于未验证的账号） */
  static async resend(email: string): Promise<void> {
    const user = await UserRepository.findByEmail(String(email || '').trim())
    // 已验证或不存在都静默返回，避免账号枚举
    if (!user || (user as any).email_verified) return
    await this.issue(user.id, user.email, (user as any).nickname || user.email)
  }
}
