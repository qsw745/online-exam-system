import { LogService } from '@/modules/logs/services/log.service'
import bcrypt from 'bcryptjs'
import type { UserDTO, UserRole, UserSettings, UserStatus } from '../domain/user.model'
import { UserRepository } from '../repositories/user.repository.js'
import { OrgUserService } from '@/modules/orgs/services/org-user.service'
import { OrgUserRepository } from '@/modules/orgs/repositories/org-user.repository'

export class UserService {
    private readonly orgSvc = new OrgUserService()
    constructor(private readonly repo = new UserRepository()) {}

    async getById(userId: number) {
        const user = await this.repo.getById(userId)
        if (!user) return null

        // 统计信息（原有逻辑）
        const stats = await this.repo.statsOfUser(userId)

        // ✅ 仅调用 repository（不写 SQL）
        const { orgId, org_name } = await this.repo.getPrimaryOrgForUser(userId)

        // 同时兼容 orgId / org_id
        return { ...user, statistics: stats, orgId, org_id: orgId, org_name }
    }

    async getMe(userId: number) {
        return this.repo.getById(userId)
    }

    async list(params: { page: number; limit: number; role?: UserRole; search?: string }) {
        return this.repo.list(params)
    }

    /** 按组织查询用户（转调 OrgUserService），返回 {items,total} */
    async listByOrg(params: {
        orgId: number; page: number; limit: number; role?: string; search?: string; includeChildren?: boolean
    }) {
        return this.orgSvc.listUsers(params)
    }

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

    async resetPassword(targetUserId: number, actor?: { id?: number; username?: string }, req?: any) {
        const defaultPassword = '123456'
        const hashed = await bcrypt.hash(defaultPassword, 10)
        const ok = await this.repo.resetPassword(targetUserId, hashed)
        if (!ok) {
            throw new Error('重置密码失败')
        }else {
            return defaultPassword
        }

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

    async getSettings(userId: number): Promise<UserSettings> {
        return (
            (await this.repo.getSettings(userId)) || {
                notifications: { email: true, push: true, sound: true },
                privacy: { profile_visibility: 'public', show_activity: true, show_results: true },
                appearance: { theme: 'light', language: 'zh-CN' },
            }
        )
    }

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

    /** 当 /users/:id 接收到 orgId|org_id 字段时，统一在业务层编排 org 关系 */
    async setUserOrg(
        targetUserId: number,
        nextOrgId: number | null, // null=移除主组织；number=设置/迁移为该组织
        actor?: { id?: number; username?: string }
    ) {
        if (!(nextOrgId === null || Number.isFinite(nextOrgId))) return

        const prevOrgId = await OrgUserRepository.currentPrimaryOrgId(targetUserId)

        if (nextOrgId === null) {
            if (prevOrgId != null) {
                await this.orgSvc.removeUser(actor, prevOrgId, targetUserId)
            }
            return
        }

        if (prevOrgId == null) {
            await this.orgSvc.setPrimary(actor, nextOrgId, targetUserId)
            return
        }

        if (prevOrgId !== nextOrgId) {
            await this.orgSvc.moveUser(actor, prevOrgId, nextOrgId, targetUserId)
            return
        }

        await this.orgSvc.setPrimary(actor, nextOrgId, targetUserId)
    }
}

export default UserService
