// apps/backend/src/modules/users/services/user.service.ts
import bcrypt from 'bcryptjs'
import { LogService } from '@modules/analytics/services/log.service'
import type { UserDTO, UserRole, UserSettings, UserStatus } from '../domain/user.model'
import { UserRepository } from '../repositories/user.repository.js'

export class UserService {
  constructor(private readonly repo = new UserRepository()) {}

  async getById(userId: number) {
    const user = await this.repo.getById(userId)
    if (!user) return null
    const stats = await this.repo.statsOfUser(userId)
    return { ...user, statistics: stats }
  }

  async getMe(userId: number) {
    return this.repo.getById(userId)
  }

  async updateMe(userId: number, patch: Partial<Pick<UserDTO, 'nickname' | 'school' | 'class_name'>>) {
    const updated = await this.repo.updateUser(userId, patch as any)
    if (!updated) throw new Error('更新失败')
    await LogService.logUserAction({
      userId,
      username: updated.username,
      action: 'update_profile',
      resourceType: 'user',
      resourceId: Number(userId),
      details: { updatedFields: Object.keys(patch) },
    } as any)
    return updated
  }

  async uploadAvatar(userId: number, avatarUrl: string) {
    const updated = await this.repo.updateUser(userId, { avatar_url: avatarUrl })
    if (!updated) throw new Error('更新头像失败')
    await LogService.logUserAction({
      userId,
      username: updated.username,
      action: 'upload_avatar',
      resourceType: 'user',
      resourceId: Number(userId),
      details: { avatarUrl },
    } as any)
    return updated
  }

  async list(params: { page: number; limit: number; role?: UserRole; search?: string }) {
    return this.repo.list(params)
  }

  async adminUpdate(
    targetUserId: number,
    patch: Partial<Pick<UserDTO, 'username' | 'email' | 'role' | 'avatar_url' | 'nickname' | 'school' | 'class_name'>>,
    actor?: { id?: number; username?: string }
  ) {
    const updated = await this.repo.updateUser(targetUserId, patch)
    if (!updated) throw new Error('用户不存在')

    await LoggerService.logUserAction({
      userId: actor?.id || 0,
      username: actor?.username,
      action: 'update_user',
      resourceType: 'user',
      resourceId: targetUserId,
      details: { updatedFields: Object.keys(patch) },
    } as any)

    return updated
  }

  async updateStatus(targetUserId: number, status: UserStatus, actor?: { id?: number; username?: string }) {
    const updated = await this.repo.updateStatus(targetUserId, status)
    if (!updated) throw new Error('更新用户状态失败')
    await LoggerService.logUserAction({
      userId: actor?.id || 0,
      username: actor?.username,
      action: 'update_user_status',
      resourceType: 'user',
      resourceId: targetUserId,
      details: { newStatus: status },
    } as any)
  }

  async resetPassword(targetUserId: number, actor?: { id?: number; username?: string }) {
    const defaultPassword = '123456'
    const hashed = await bcrypt.hash(defaultPassword, 10)
    const ok = await this.repo.resetPassword(targetUserId, hashed)
    if (!ok) throw new Error('重置密码失败')

    await LoggerService.logUserAction({
      userId: actor?.id || 0,
      username: actor?.username,
      action: 'reset_user_password',
      resourceType: 'user',
      resourceId: targetUserId,
      details: { targetUserId },
    } as any)
  }

  async deleteUser(targetUserId: number, targetRole: UserRole, actor?: { id?: number; username?: string }) {
    if (targetRole === 'admin') throw new Error('管理员账号不允许删除')
    const ok = await this.repo.deleteUser(targetUserId)
    if (!ok) throw new Error('删除用户失败')
    await LoggerService.logUserAction({
      userId: actor?.id || 0,
      username: actor?.username,
      action: 'delete_user',
      resourceType: 'user',
      resourceId: targetUserId,
      details: { targetUserId },
    } as any)
  }

  async getSettings(userId: number): Promise<UserSettings> {
    return (
      (await this.repo.getSettings(userId)) || {
        notifications: { email: true, push: true, sound: true },
        privacy: { profile_visibility: 'public', show_activity: true, show_results: true },
        appearance: { theme: 'light', language: 'zh-CN' },
      }
    )
  }

  async saveSettings(userId: number, settings: UserSettings) {
    await this.repo.saveSettings(userId, settings)
    await LoggerService.logUserAction({
      userId,
      action: 'save_settings',
      resourceType: 'user_settings',
      resourceId: userId,
      details: { keys: Object.keys(settings || {}) },
    } as any)
    return settings
  }
}
