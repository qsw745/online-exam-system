// apps/backend/src/modules/users/controllers/user.controller.ts
import type { Response } from 'express'
import type { AuthRequest } from '@/types/auth.js'
import type { ApiResponse } from '@/types/response.js'
import { UserService } from '../services/user.service.js'

const svc = new UserService()

export class UserController {
    static async getById(req: AuthRequest, res: Response<ApiResponse<any>>) {
        try {
            const id = Number(req.params.id)
            if (!Number.isFinite(id)) return res.badRequest('无效的用户ID')
            const user = await svc.getById(id)
            if (!user) return res.notFound('用户不存在')
            return res.ok(user, '获取成功')
        } catch (e) {
            console.error('获取用户详情错误:', e)
            return res.internal('获取用户详情失败')
        }
    }

    static async getCurrentUser(req: AuthRequest, res: Response<ApiResponse<any>>) {
        try {
            if (!req.user?.id) return res.unauthorized('未授权')
            const user = await svc.getMe(req.user.id)
            if (!user) return res.notFound('用户不存在')
            return res.ok(user, '获取成功')
        } catch (e) {
            console.error('获取当前用户信息错误:', e)
            return res.internal('获取用户信息失败')
        }
    }

    static async updateCurrentUser(req: AuthRequest, res: Response<ApiResponse<any>>) {
        try {
            if (!req.user?.id) return res.unauthorized('未授权')
            const updated = await svc.updateMe(req.user.id, {
                nickname: req.body?.nickname,
                school: req.body?.school,
                class_name: req.body?.class_name,
            })
            return res.ok(updated, '更新成功')
        } catch (e) {
            console.error('更新当前用户信息错误:', e)
            return res.internal('更新用户信息失败')
        }
    }

    static async uploadAvatar(req: AuthRequest, res: Response<ApiResponse<any>>) {
        try {
            if (!req.user?.id) return res.unauthorized('未授权')
            if (!req.file) return res.badRequest('没有提供头像文件')
            const baseUrl = process.env.PUBLIC_URL || process.env.API_URL || 'http://localhost:3000'
            const avatarUrl = `${baseUrl}/uploads/avatars/${req.file.filename}`
            const updated = await svc.uploadAvatar(req.user.id, avatarUrl)
            return res.ok(updated, '上传成功')
        } catch (e) {
            console.error('上传头像错误:', e)
            return res.internal('上传头像失败')
        }
    }

    static async list(req: AuthRequest, res: Response<ApiResponse<any>>) {
        try {
            const page = Math.max(1, parseInt(String(req.query.page ?? '1')) || 1)
            const limit = Math.max(1, parseInt(String(req.query.limit ?? '10')) || 10)
            const role = (req.query.role as any) || undefined
            const search = (req.query.search as string) || undefined
            const orgIdRaw = (req.query.orgId as any) ?? (req.query.org_id as any)
            const includeChildren = req.query.include_children === '1' || req.query.include_children === 'true'

            if (orgIdRaw !== undefined && orgIdRaw !== null && String(orgIdRaw) !== '') {
                const orgId = Number(orgIdRaw)
                if (!Number.isFinite(orgId)) return res.badRequest('无效的组织ID')
                const r = await svc.listByOrg({ orgId, page, limit, role, search, includeChildren })
                return res.ok({ users: r.items, total: r.total, page, limit })
            }

            const r = await svc.list({ page, limit, role, search })
            return res.ok({ ...r, page, limit })
        } catch (e) {
            console.error('获取用户列表错误:', e)
            return res.internal('获取用户列表失败')
        }
    }

    static async update(req: AuthRequest, res: Response<ApiResponse<any>>) {
        try {
            const id = Number(req.params.id)
            if (!Number.isFinite(id)) return res.badRequest('无效的用户ID')

            const updated = await svc.adminUpdate(
                id,
                {
                    username: req.body?.username,
                    email: req.body?.email,
                    role: req.body?.role,
                    avatar_url: req.body?.avatar_url,
                    nickname: req.body?.nickname,
                    school: req.body?.school,
                    class_name: req.body?.class_name,
                },
                { id: req.user?.id, username: req.user?.username }
            )

            const hasOrgField =
                Object.prototype.hasOwnProperty.call(req.body || {}, 'orgId') ||
                Object.prototype.hasOwnProperty.call(req.body || {}, 'org_id')
            if (hasOrgField) {
                const raw = (req.body?.orgId ?? req.body?.org_id) as any
                const nextOrgId = raw === null || raw === '' || typeof raw === 'undefined' ? null : Number(raw)
                if (!(nextOrgId === null || Number.isFinite(nextOrgId))) return res.badRequest('无效的组织ID')
                await svc.setUserOrg(id, nextOrgId, { id: req.user?.id, username: req.user?.username })
            }

            return res.ok(updated, '更新成功')
        } catch (e) {
            console.error('更新用户信息错误:', e)
            return res.internal('更新用户信息失败')
        }
    }

    static async updateStatus(req: AuthRequest, res: Response<ApiResponse<{ message: string }>>) {
        try {
            const id = Number(req.params.id)
            if (!Number.isFinite(id)) return res.badRequest('无效的用户ID')
            const status = req.body?.status
            if (!status || !['active', 'disabled'].includes(status)) return res.badRequest('无效的状态值')

            const u = await svc.getById(id)
            if (!u) return res.notFound('用户不存在')
            if (u.role === 'admin' && status === 'disabled') return res.forbidden('管理员账号不允许禁用')

            await svc.updateStatus(id, status, { id: req.user?.id, username: req.user?.username })
            return res.ok({ message: `用户状态已更新为${status === 'active' ? '启用' : '禁用'}` })
        } catch (e) {
            console.error('更新用户状态错误:', e)
            return res.internal('更新用户状态失败')
        }
    }

    static async resetPassword(req: AuthRequest, res: Response<ApiResponse<{ password: string }>>) {
        try {
            const id = Number(req.params.id)
            if (!Number.isFinite(id)) return res.badRequest('无效的用户ID')

            const u = await svc.getById(id)
            if (!u) return res.notFound('用户不存在')

            const password: string = await svc.resetPassword(id, { id: req.user?.id, username: req.user?.username })
            return res.ok({ password }, '密码已重置为系统默认密码')
        } catch (e) {
            console.error('重置用户密码错误:', e)
            return res.internal('重置密码失败')
        }
    }

    static async delete(req: AuthRequest, res: Response<ApiResponse<null>>) {
        try {
            const id = Number(req.params.id)
            if (!Number.isFinite(id)) return res.badRequest('无效的用户ID')
            const u = await svc.getById(id)
            if (!u) return res.notFound('用户不存在')
            await svc.deleteUser(id, u.role, { id: req.user?.id, username: req.user?.username })
            return res.ok(null, '用户删除成功')
        } catch (e) {
            console.error('删除用户错误:', e)
            return res.internal('删除用户失败')
        }
    }

    static async getSettings(req: AuthRequest, res: Response<ApiResponse<any>>) {
        try {
            if (!req.user?.id) return res.unauthorized('未授权')
            const settings = await svc.getSettings(req.user.id)
            return res.ok(settings, '获取成功')
        } catch (e) {
            console.error('获取用户设置错误:', e)
            return res.internal('获取用户设置失败')
        }
    }

    static async saveSettings(req: AuthRequest, res: Response<ApiResponse<any>>) {
        try {
            if (!req.user?.id) return res.unauthorized('未授权')
            const settings = req.body
            if (typeof settings !== 'object' || settings === null) return res.badRequest('设置格式无效')
            const saved = await svc.saveSettings(req.user.id, settings)
            return res.ok(saved, '保存成功')
        } catch (e) {
            console.error('保存用户设置错误:', e)
            return res.internal('保存用户设置失败')
        }
    }
}

export default UserController
