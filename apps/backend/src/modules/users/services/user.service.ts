// apps/backend/src/modules/users/services/user.service.ts
import { LogService } from '@/modules/logs/services/log.service'
import bcrypt from 'bcryptjs'
import type { UserDTO, UserRole, UserSettings, UserStatus } from '../domain/user.model'
import { UserRepository } from '../repositories/user.repository.js'

export class UserService {
  constructor(private readonly repo = new UserRepository()) {}

  /** 获取用户详情（含统计） */
  async getById(userId: number) {
    const user = await this.repo.getById(userId)
    if (!user) return null
    const stats = await this.repo.statsOfUser(userId)
    return { ...user, statistics: stats }
  }

  /** 获取当前用户基础信息 */
  async getMe(userId: number) {
    return this.repo.getById(userId)
  }

  /** 列表（分页 + 可选角色/搜索）—— 供控制器 UserController.list 调用 */
  async list(params: { page: number; limit: number; role?: UserRole; search?: string }) {
    return this.repo.list(params)
  }

  /** 更新自己的资料并写入中文操作日志 */
  async updateMe(userId: number, patch: Partial<Pick<UserDTO, 'nickname' | 'school' | 'class_name'>>, req?: any) {
    const updated = await this.repo.updateUser(userId, patch as any)
    if (!updated) throw new Error('更新失败')

    await LogService.log(
      {
        type: 'user',
        userId,
        username: updated.username,
        action: '更新个人资料',
        resourceType: 'user',
        resourceId: Number(userId),
        details: { 更新字段: Object.keys(patch) },
      },
      req
    )
    return updated
  }

  /** 上传头像并写入中文操作日志 */
  async uploadAvatar(userId: number, avatarUrl: string, req?: any) {
    const updated = await this.repo.updateUser(userId, { avatar_url: avatarUrl })
    if (!updated) throw new Error('更新头像失败')

    await LogService.log(
      {
        type: 'user',
        userId,
        username: updated.username,
        action: '上传头像',
        resourceType: 'user',
        resourceId: Number(userId),
        details: { 头像地址: avatarUrl },
      },
      req
    )
    return updated
  }

  /** 管理员修改用户信息并写入日志 */
  async adminUpdate(
    targetUserId: number,
    patch: Partial<Pick<UserDTO, 'username' | 'email' | 'role' | 'avatar_url' | 'nickname' | 'school' | 'class_name'>>,
    actor?: { id?: number; username?: string },
    req?: any
  ) {
    const updated = await this.repo.updateUser(targetUserId, patch)
    if (!updated) throw new Error('用户不存在')

    await LogService.log(
      {
        type: 'user',
        userId: actor?.id || 0,
        username: actor?.username,
        action: '管理员修改用户信息',
        resourceType: 'user',
        resourceId: targetUserId,
        details: { 修改字段: Object.keys(patch) },
      },
      req
    )
    return updated
  }

  /** 修改用户状态并写入日志 */
  async updateStatus(targetUserId: number, status: UserStatus, actor?: { id?: number; username?: string }, req?: any) {
    const updated = await this.repo.updateStatus(targetUserId, status)
    if (!updated) throw new Error('更新用户状态失败')

    await LogService.log(
      {
        type: 'user',
        userId: actor?.id || 0,
        username: actor?.username,
        action: '修改用户状态',
        resourceType: 'user',
        resourceId: targetUserId,
        details: { 新状态: status },
      },
      req
    )
  }

  /** 重置用户密码并写入日志（默认 123456） */
  async resetPassword(targetUserId: number, actor?: { id?: number; username?: string }, req?: any) {
    const defaultPassword = '123456'
    const hashed = await bcrypt.hash(defaultPassword, 10)
    const ok = await this.repo.resetPassword(targetUserId, hashed)
    if (!ok) throw new Error('重置密码失败')

    await LogService.log(
      {
        type: 'user',
        userId: actor?.id || 0,
        username: actor?.username,
        action: '重置用户密码',
        resourceType: 'user',
        resourceId: targetUserId,
        details: { 目标用户ID: targetUserId },
      },
      req
    )
  }

  /** 删除用户并写入日志（禁止删除管理员的保护请在 controller 里先判断角色） */
  async deleteUser(targetUserId: number, targetRole: UserRole, actor?: { id?: number; username?: string }, req?: any) {
    if (targetRole === 'admin') throw new Error('管理员账号不允许删除')
    const ok = await this.repo.deleteUser(targetUserId)
    if (!ok) throw new Error('删除用户失败')

    await LogService.log(
      {
        type: 'user',
        userId: actor?.id || 0,
        username: actor?.username,
        action: '删除用户',
        resourceType: 'user',
        resourceId: targetUserId,
        details: { 目标用户ID: targetUserId },
      },
      req
    )
  }

  /** 获取个人设置 */
  async getSettings(userId: number): Promise<UserSettings> {
    return (
      (await this.repo.getSettings(userId)) || {
        notifications: { email: true, push: true, sound: true },
        privacy: { profile_visibility: 'public', show_activity: true, show_results: true },
        appearance: { theme: 'light', language: 'zh-CN' },
      }
    )
  }

  /** 保存个人设置并写入日志 */
  async saveSettings(userId: number, settings: UserSettings, req?: any) {
    await this.repo.saveSettings(userId, settings)
    await LogService.log(
      {
        type: 'user',
        userId,
        action: '保存个人设置',
        resourceType: 'user_settings',
        resourceId: userId,
        details: { 变更项: Object.keys(settings || {}) },
      },
      req
    )
    return settings
  }
}

export default UserService
