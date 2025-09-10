import { LogService } from '@/modules/logs/services/log.service'
import bcrypt from 'bcryptjs'
import type { UserDTO, UserRole, UserSettings, UserStatus } from '../domain/user.model'
import { UserRepository } from '../repositories/user.repository.js'

export class UserService {
  constructor(private readonly repo = new UserRepository()) {}

  async updateMe(userId: number, patch: Partial<Pick<UserDTO, 'nickname' | 'school' | 'class_name'>>, req?: any) {
    const updated = await this.repo.updateUser(userId, patch as any)
    if (!updated) throw new Error('更新失败')
    await LogService.userAction(
      {
        userId,
        username: updated.username,
        action: 'update_profile',
        resourceType: 'user',
        resourceId: Number(userId),
        details: { updatedFields: Object.keys(patch) },
      },
      req
    )
    return updated
  }

  async uploadAvatar(userId: number, avatarUrl: string, req?: any) {
    const updated = await this.repo.updateUser(userId, { avatar_url: avatarUrl })
    if (!updated) throw new Error('更新头像失败')
    await LogService.userAction(
      {
        userId,
        username: updated.username,
        action: 'upload_avatar',
        resourceType: 'user',
        resourceId: Number(userId),
        details: { avatarUrl },
      },
      req
    )
    return updated
  }

  async adminUpdate(
    targetUserId: number,
    patch: Partial<Pick<UserDTO, 'username' | 'email' | 'role' | 'avatar_url' | 'nickname' | 'school' | 'class_name'>>,
    actor?: { id?: number; username?: string },
    req?: any
  ) {
    const updated = await this.repo.updateUser(targetUserId, patch)
    if (!updated) throw new Error('用户不存在')

    await LogService.userAction(
      {
        userId: actor?.id || 0,
        username: actor?.username,
        action: 'update_user',
        resourceType: 'user',
        resourceId: targetUserId,
        details: { updatedFields: Object.keys(patch) },
      },
      req
    )
    return updated
  }

  async updateStatus(targetUserId: number, status: UserStatus, actor?: { id?: number; username?: string }, req?: any) {
    const updated = await this.repo.updateStatus(targetUserId, status)
    if (!updated) throw new Error('更新用户状态失败')
    await LogService.userAction(
      {
        userId: actor?.id || 0,
        username: actor?.username,
        action: 'update_user_status',
        resourceType: 'user',
        resourceId: targetUserId,
        details: { newStatus: status },
      },
      req
    )
  }

  async resetPassword(targetUserId: number, actor?: { id?: number; username?: string }, req?: any) {
    const defaultPassword = '123456'
    const hashed = await bcrypt.hash(defaultPassword, 10)
    const ok = await this.repo.resetPassword(targetUserId, hashed)
    if (!ok) throw new Error('重置密码失败')

    await LogService.userAction(
      {
        userId: actor?.id || 0,
        username: actor?.username,
        action: 'reset_user_password',
        resourceType: 'user',
        resourceId: targetUserId,
        details: { targetUserId },
      },
      req
    )
  }

  async saveSettings(userId: number, settings: UserSettings, req?: any) {
    await this.repo.saveSettings(userId, settings)
    await LogService.userAction(
      {
        userId,
        action: 'save_settings',
        resourceType: 'user_settings',
        resourceId: userId,
        details: { keys: Object.keys(settings || {}) },
      },
      req
    )
    return settings
  }
}
