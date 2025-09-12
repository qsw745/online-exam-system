// apps/backend/src/modules/orgs/controllers/org-user.controller.ts
import type { Response } from 'express'
import type { AuthRequest } from 'types/auth'
import type { ApiResponse } from 'types/response'
import type { OrgUserListData } from '../domain/org-user.model'
import { OrgUserService } from '../services/org-user.service'
// ✅ 补上仓库导入
import { OrgUserRepository } from '../repositories/org-user.repository'
const svc = new OrgUserService()

export const OrgUserController = {
  async listUsers(req: AuthRequest, res: Response<ApiResponse<OrgUserListData>>) {
    try {
      const orgId = Number((req.params as any)?.orgId ?? (req.query as any)?.orgId)
      if (!Number.isFinite(orgId)) return res.status(400).json({ success: false, error: '无效的组织ID' })
      const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10))
      const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)))
      const search = (req.query.search as string | undefined)?.trim()
      const role = (req.query.role as string | undefined)?.trim()
      const includeChildren = req.query.include_children === '1' || req.query.include_children === 'true'
      const data = await svc.listUsers({ orgId, page, limit, search, role, includeChildren })
      return res.json({ success: true, data })
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || '获取机构用户列表失败' })
    }
  },

  async addUsers(req: AuthRequest, res: Response<ApiResponse<{ added: number }>>) {
    try {
      const orgId = Number(req.params.orgId)
      if (!Number.isFinite(orgId)) return res.status(400).json({ success: false, error: '无效的组织ID' })
      const userIds: number[] = Array.isArray(req.body?.user_ids) ? req.body.user_ids.map(Number).filter(Boolean) : []
      if (!userIds.length) return res.status(400).json({ success: false, error: 'user_ids 不能为空' })
      const data = await svc.addUsers({ id: req.user?.id, username: req.user?.username }, orgId, userIds, {
        ip: req.ip,
        ua: req.get('User-Agent') || undefined,
      })
      return res.status(201).json({ success: true, data })
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || '批量添加机构用户失败' })
    }
  },
  // ✅ 新增：按邮箱批量添加
  async addUsersByEmail(req: AuthRequest, res: Response<ApiResponse<{ added: number; matched: number; not_found: string[] }>>) {
    try {
      const orgId = Number(req.params.orgId)
      if (!Number.isFinite(orgId)) return res.status(400).json({ success: false, error: '无效的组织ID' })
      let emails: string[] = []

      const raw = (req.body?.emails ?? req.body?.email ?? req.body) as any
      if (Array.isArray(raw)) {
        emails = raw
      } else if (typeof raw === 'string') {
        emails = raw.split(/[\s,;]/)
      } else if (raw && typeof raw === 'object' && Array.isArray(raw.emails)) {
        emails = raw.emails
      }

      emails = emails.map(s => String(s || '').trim().toLowerCase()).filter(Boolean)
      emails = Array.from(new Set(emails))
      if (!emails.length) return res.status(400).json({ success: false, error: 'emails 不能为空' })

      const pairs = await OrgUserRepository.findUserIdsByEmails(emails)
      const foundIds = pairs.map(p => p.id)
      const matched = pairs.length
      const foundEmailsSet = new Set(pairs.map(p => p.email?.toLowerCase()))
      const not_found = emails.filter(e => !foundEmailsSet.has(e))

      if (!foundIds.length) {
        return res.status(404).json({ success: false, error: '未找到任何邮箱对应的用户', data: { added: 0, matched: 0, not_found } as any })
      }

      const data = await svc.addUsers({ id: req.user?.id, username: req.user?.username }, orgId, foundIds, {
        ip: req.ip,
        ua: req.get('User-Agent') || undefined,
      })

      return res.status(201).json({ success: true, data: { added: data.added, matched, not_found } as any })
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || '按邮箱添加机构用户失败' })
    }
  },
  async removeUser(req: AuthRequest, res: Response<ApiResponse<{ message: string }>>) {
    try {
      const orgId = Number(req.params.orgId)
      const userId = Number(req.params.userId)
      if (![orgId, userId].every(Number.isFinite)) return res.status(400).json({ success: false, error: '无效的参数' })
      const data = await svc.removeUser({ id: req.user?.id, username: req.user?.username }, orgId, userId, {
        ip: req.ip,
        ua: req.get('User-Agent') || undefined,
      })
      return res.json({ success: true, data })
    } catch (e: any) {
      const code = /主组织|不在此组织/.test(e?.message) ? 400 : 500
      return res.status(code).json({ success: false, error: e?.message || '移除机构用户失败' })
    }
  },

  async setPrimary(req: AuthRequest, res: Response<ApiResponse<{ user_id: number; org_id: number }>>) {
    try {
      const orgId = Number(req.params.orgId ?? req.body?.orgId)
      const userId = Number(req.params.userId)
      if (![orgId, userId].every(Number.isFinite)) return res.status(400).json({ success: false, error: '无效的参数' })
      const data = await svc.setPrimary({ id: req.user?.id, username: req.user?.username }, orgId, userId, {
        ip: req.ip,
        ua: req.get('User-Agent') || undefined,
      })
      return res.json({ success: true, data })
    } catch (e: any) {
      const code = /不存在|失败/.test(e?.message) ? 400 : 500
      return res.status(code).json({ success: false, error: e?.message || '设置主组织失败' })
    }
  },

  async moveUser(req: AuthRequest, res: Response) {
    try {
      const fromOrgId = Number(req.params.fromOrgId)
      const toOrgId = Number(req.params.toOrgId)
      const userId = Number(req.params.userId)
      if (![fromOrgId, toOrgId, userId].every(Number.isFinite))
        return res.status(400).json({ success: false, error: '无效的参数' })
      const data = await svc.moveUser({ id: req.user?.id, username: req.user?.username }, fromOrgId, toOrgId, userId, {
        ip: req.ip,
        ua: req.get('User-Agent') || undefined,
      })
      return res.json({ success: true, data })
    } catch (e: any) {
      const code = /相同|不存在|失败/.test(e?.message) ? 400 : 500
      return res.status(code).json({ success: false, error: e?.message || '移动用户部门失败' })
    }
  },
}

export default OrgUserController
