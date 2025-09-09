// apps/backend/src/modules/auth/controllers/auth.controller.ts
import type { Response } from 'express'
import type { AuthRequest } from 'types/auth'
import type { ApiResponse } from 'types/response'
import { AuthService } from '../services/auth.service'

const svc = new AuthService()

export class AuthController {
  static async register(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const { username, email, password } = req.body || {}
      if (!email || !password) return res.status(400).json({ success: false, error: '缺少必填字段' })
      const data = await svc.register({ username, email, password })
      return res.status(201).json({ success: true, data })
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || '创建用户失败' })
    }
  }

  static async login(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const { email, password } = req.body || {}
      const data = await svc.login(email, password, { ip: req.ip, ua: req.get('User-Agent') || undefined })
      return res.json({ success: true, data })
    } catch (e: any) {
      const msg = e?.message || '登录失败'
      const code = /不存在|密码|禁用/.test(msg) ? (msg.includes('禁用') ? 403 : 401) : 500
      return res.status(code).json({ success: false, error: msg })
    }
  }

  static async refresh(req: AuthRequest, res: Response<ApiResponse<{ token: string }>>) {
    try {
      const rt = (req.cookies as any)?.rt
      if (!rt) return res.status(401).json({ success: false, error: '缺少刷新令牌' })
      const { token, refresh } = await svc.refresh(rt)
      svc.setRefreshCookie(res as any, refresh)
      return res.json({ success: true, data: { token } })
    } catch (e: any) {
      return res.status(401).json({ success: false, error: e?.message || '刷新失败，请重新登录' })
    }
  }

  static async logout(req: AuthRequest, res: Response<ApiResponse<null>>) {
    await svc.logout((req.cookies as any)?.rt)
    ;(res as any).clearCookie?.('rt', { path: '/api/auth' })
    return res.json({ success: true, data: null, message: '已退出登录' } as any)
  }

  // 兼容旧路由
  static async forgotPassword(_req: AuthRequest, res: Response<ApiResponse<any>>) {
    return res.json({ success: true, data: null, message: '请使用 /auth/password-reset/* 路由' })
  }
}
