// apps/backend/src/modules/users/controllers/user.controller.ts
import type { Response } from 'express'
import type { AuthRequest } from 'types/auth.js'
import type { ApiResponse } from 'types/response.js'
import { UserService } from '../services/user.service.js'

const svc = new UserService()

export class UserController {
  static async getById(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: '无效的用户ID' })
      const user = await svc.getById(id)
      if (!user) return res.status(404).json({ success: false, error: '用户不存在' })
      return res.json({ success: true, data: user })
    } catch (e: any) {
      console.error('获取用户详情错误:', e)
      return res.status(500).json({ success: false, error: '获取用户详情失败' })
    }
  }

  static async getCurrentUser(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      if (!req.user?.id) return res.status(401).json({ success: false, error: '未授权' })
      const user = await svc.getMe(req.user.id)
      if (!user) return res.status(404).json({ success: false, error: '用户不存在' })
      return res.json({ success: true, data: user })
    } catch (e: any) {
      console.error('获取当前用户信息错误:', e)
      return res.status(500).json({ success: false, error: '获取用户信息失败' })
    }
  }

  static async updateCurrentUser(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      if (!req.user?.id) return res.status(401).json({ success: false, error: '未授权' })
      const updated = await svc.updateMe(req.user.id, {
        nickname: req.body?.nickname,
        school: req.body?.school,
        class_name: req.body?.class_name,
      })
      return res.json({ success: true, data: updated })
    } catch (e: any) {
      console.error('更新当前用户信息错误:', e)
      return res.status(500).json({ success: false, error: '更新用户信息失败' })
    }
  }

  static async uploadAvatar(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      if (!req.user?.id) return res.status(401).json({ success: false, error: '未授权' })
      if (!req.file) return res.status(400).json({ success: false, error: '没有提供头像文件' })
      const baseUrl = process.env.PUBLIC_URL || process.env.API_URL || 'http://localhost:3000'
      const avatarUrl = `${baseUrl}/uploads/avatars/${req.file.filename}`
      const updated = await svc.uploadAvatar(req.user.id, avatarUrl)
      return res.json({ success: true, data: updated })
    } catch (e: any) {
      console.error('上传头像错误:', e)
      return res.status(500).json({ success: false, error: '上传头像失败' })
    }
  }

  static async list(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const page = Math.max(1, parseInt(String(req.query.page ?? '1')) || 1)
      const limit = Math.max(1, parseInt(String(req.query.limit ?? '10')) || 10)
      const role = req.query.role as any
      const search = (req.query.search as string) || undefined
      const r = await svc.list({ page, limit, role, search })
      return res.json({ success: true, data: { ...r, page, limit } })
    } catch (e: any) {
      console.error('获取用户列表错误:', e)
      return res.status(500).json({ success: false, error: '获取用户列表失败' })
    }
  }

  static async update(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: '无效的用户ID' })
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
      return res.json({ success: true, data: updated })
    } catch (e: any) {
      console.error('更新用户信息错误:', e)
      return res.status(500).json({ success: false, error: '更新用户信息失败' })
    }
  }

  static async updateStatus(req: AuthRequest, res: Response<ApiResponse<{ message: string }>>) {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: '无效的用户ID' })
      const status = req.body?.status
      if (!status || !['active', 'disabled'].includes(status)) {
        return res.status(400).json({ success: false, error: '无效的状态值' })
      }

      // 保护 admin 禁用在 controller 里需要先查角色
      const u = await svc.getById(id)
      if (!u) return res.status(404).json({ success: false, error: '用户不存在' })
      if (u.role === 'admin' && status === 'disabled') {
        return res.status(403).json({ success: false, error: '管理员账号不允许禁用' })
      }

      await svc.updateStatus(id, status, { id: req.user?.id, username: req.user?.username })
      return res.json({ success: true, data: { message: `用户状态已更新为${status === 'active' ? '启用' : '禁用'}` } })
    } catch (e: any) {
      console.error('更新用户状态错误:', e)
      return res.status(500).json({ success: false, error: '更新用户状态失败' })
    }
  }

  static async resetPassword(req: AuthRequest, res: Response<ApiResponse<{ message: string }>>) {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: '无效的用户ID' })
      const u = await svc.getById(id)
      if (!u) return res.status(404).json({ success: false, error: '用户不存在' })

      await svc.resetPassword(id, { id: req.user?.id, username: req.user?.username })
      return res.json({ success: true, data: { message: '密码已重置为系统默认密码' } })
    } catch (e: any) {
      console.error('重置用户密码错误:', e)
      return res.status(500).json({ success: false, error: '重置密码失败' })
    }
  }

  static async delete(req: AuthRequest, res: Response<ApiResponse<{ message: string }>>) {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: '无效的用户ID' })
      const u = await svc.getById(id)
      if (!u) return res.status(404).json({ success: false, error: '用户不存在' })
      await svc.deleteUser(id, u.role, { id: req.user?.id, username: req.user?.username })
      return res.json({ success: true, data: { message: '用户删除成功' } })
    } catch (e: any) {
      console.error('删除用户错误:', e)
      return res.status(500).json({ success: false, error: '删除用户失败' })
    }
  }

  static async getSettings(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      if (!req.user?.id) return res.status(401).json({ success: false, error: '未授权' })
      const settings = await svc.getSettings(req.user.id)
      return res.json({ success: true, data: settings })
    } catch (e: any) {
      console.error('获取用户设置错误:', e)
      return res.status(500).json({ success: false, error: '获取用户设置失败' })
    }
  }

  static async saveSettings(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      if (!req.user?.id) return res.status(401).json({ success: false, error: '未授权' })
      const settings = req.body
      if (typeof settings !== 'object' || settings === null) {
        return res.status(400).json({ success: false, error: '设置格式无效' })
      }
      const saved = await svc.saveSettings(req.user.id, settings)
      return res.json({ success: true, data: saved })
    } catch (e: any) {
      console.error('保存用户设置错误:', e)
      return res.status(500).json({ success: false, error: '保存用户设置失败' })
    }
  }
}
