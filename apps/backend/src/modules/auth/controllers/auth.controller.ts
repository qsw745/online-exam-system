// apps/backend/src/modules/auth/controllers/auth.controller.ts
import type { Response } from 'express'
import type { AuthRequest } from '@/types/auth'
import type { ApiResponse } from '@/types/response'
import { AuthService } from '../services/auth.service'

const svc = new AuthService()

export class AuthController {
  static async register(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const { username, email, password } = req.body || {}
      if (!email || !password) {
        return res.status(400).json({ success: false, error: '缺少必填字段' })
      }
      // 拿到 access + refresh
      const { token, refresh, user } = await svc.register({ username, email, password })
      // 写入 HttpOnly 刷新 Cookie
      svc.setRefreshCookie(res, refresh)
      // 统一结构：data.token / data.user
      return res.status(201).json({ success: true, data: { token, user } })
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || '创建用户失败' })
    }
  }

  static async login(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const { email, password } = req.body || {}
      if (!email || !password) {
        return res.status(400).json({ success: false, error: '缺少必填字段' })
      }
      const { token, refresh, user } = await svc.login(email, password, {
        ip: req.ip,
        ua: req.get('User-Agent') || undefined,
      })
      svc.setRefreshCookie(res, refresh)
      return res.json({ success: true, data: { token, user } })
    } catch (e: any) {
      const msg = e?.message || '登录失败'
      const code = /不存在|密码|禁用/.test(msg) ? (msg.includes('禁用') ? 403 : 401) : 500
      return res.status(code).json({ success: false, error: msg })
    }
  }

  static async refresh(req: AuthRequest, res: Response<ApiResponse<{ token: string }>>) {
    try {
      // 从 Cookie 里拿刷新令牌（名称与 setRefreshCookie 保持一致）
      const rt = (req as any)?.cookies?.rt || req.body?.refresh_token || req.get('x-refresh-token')
      if (!rt) return res.status(401).json({ success: false, error: '缺少刷新令牌' })

      const { token, refresh } = await svc.refresh(rt)
      // 轮换后的 refresh 写回 Cookie
      svc.setRefreshCookie(res as any, refresh)
      return res.json({ success: true, data: { token } })
    } catch (e: any) {
      return res.status(401).json({ success: false, error: e?.message || '刷新失败，请重新登录' })
    }
  }

  static async logout(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const rt = (req as any)?.cookies?.rt || req.body?.refresh_token || req.get('x-refresh-token')
      await svc.logout(rt)
    } finally {
      ;(res as any).clearCookie?.('rt', { path: '/api/auth' })
    }
    return res.json({ success: true, data: null } as any)
  }

  // 兼容旧路由
  static async forgotPassword(_req: AuthRequest, res: Response<ApiResponse<any>>) {
    return res.json({ success: true, data: null, message: '请使用 /auth/password-reset/* 路由' } as any)
  }
}
