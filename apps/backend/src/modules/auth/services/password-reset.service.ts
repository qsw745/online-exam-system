/* eslint-disable @typescript-eslint/no-explicit-any */
import bcrypt from 'bcryptjs'
import { emailService } from '@/infrastructure/email/email.service'
import { PasswordResetRepository } from '../repositories/password-reset.repository'

// 为了避免没有 @types/node 时的报错，使用 require 并声明
declare function require(name: string): any
const crypto = require('crypto') as any
declare const process: any

export class PasswordResetService {
  async send(email: string) {
    const user = await PasswordResetRepository.findUserByEmail(email)
    if (!user) return

    const existing = await PasswordResetRepository.latestValidToken(user.id)
    if (existing) {
      const minutes = Math.floor((Date.now() - new Date(existing.created_at).getTime()) / 60000)
      if (minutes < 5) throw new Error('请求过于频繁，请5分钟后再试')
    }

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    await PasswordResetRepository.invalidateAllActive(user.id)
    await PasswordResetRepository.insertToken(user.id, token, expiresAt)

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`
    await emailService.sendPasswordResetEmail(user.email, resetUrl, user.username || user.email.split('@')[0])
  }

  async validate(token: string) {
    const row = await PasswordResetRepository.findValidByToken(token)
    if (!row) throw new Error('重置令牌无效或已过期')
    return { email: row.email as string }
  }

  async reset(token: string, newPassword: string) {
    const row = await PasswordResetRepository.findValidByToken(token)
    if (!row) throw new Error('重置令牌无效或已过期')

    const hashed = await bcrypt.hash(newPassword, 10)
    await PasswordResetRepository.updateUserPassword(row.user_id, hashed)
    await PasswordResetRepository.setUsed(row.id)
    await PasswordResetRepository.setUsedAllByUser(row.user_id)
  }

  async cleanExpired(): Promise<number> {
    return PasswordResetRepository.cleanExpired()
  }
}
