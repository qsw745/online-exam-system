// apps/backend/src/modules/orgs/controllers/org-user.controller.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Response } from 'express'
import type { AuthRequest } from '@/types/auth'
import type { ApiResponse } from '@/types/response'
import { CODES } from '@/types/response'
import type { OrgUserListData } from '../domain/org-user.model'
import { OrgUserService } from '../services/org-user.service'
import { OrgUserRepository } from '../repositories/org-user.repository'

const svc = new OrgUserService()

export const OrgUserController = {
  async listUsers(req: AuthRequest, res: Response<ApiResponse<OrgUserListData>>) {
    try {
      const orgId = Number((req.params as any)?.orgId ?? (req.query as any)?.orgId)
      if (!Number.isFinite(orgId)) return res.badRequest('无效的组织ID', { code: CODES.VALIDATION_ERROR })

      const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10))
      const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)))
      const search = (req.query.search as string | undefined)?.trim()
      const role = (req.query.role as string | undefined)?.trim()
      const includeChildren = req.query.include_children === '1' || req.query.include_children === 'true'

      const data = await svc.listUsers({ orgId, page, limit, search, role, includeChildren })
      return res.ok(data, '获取成功')
    } catch (e: any) {
      return res.internal(e?.message || '获取机构用户列表失败', { code: CODES.INTERNAL_ERROR })
    }
  },

  async addUsers(req: AuthRequest, res: Response<ApiResponse<{ added: number }>>) {
    try {
      const orgId = Number(req.params.orgId)
      if (!Number.isFinite(orgId)) return res.badRequest('无效的组织ID', { code: CODES.VALIDATION_ERROR })

      const userIds: number[] = Array.isArray(req.body?.user_ids) ? req.body.user_ids.map(Number).filter(Boolean) : []
      if (!userIds.length) return res.badRequest('user_ids 不能为空', { code: CODES.VALIDATION_ERROR })

      const data = await svc.addUsers({ id: req.user?.id, username: req.user?.username }, orgId, userIds, {
        ip: req.ip,
        ua: req.get('User-Agent') || undefined,
      })
      return res.created(data, '添加成功')
    } catch (e: any) {
      return res.internal(e?.message || '批量添加机构用户失败', { code: CODES.INTERNAL_ERROR })
    }
  },

  async addUsersByEmail(
    req: AuthRequest,
    res: Response<ApiResponse<{ added: number; matched: number; not_found: string[] }>>
  ) {
    try {
      const orgId = Number(req.params.orgId)
      if (!Number.isFinite(orgId)) return res.badRequest('无效的组织ID', { code: CODES.VALIDATION_ERROR })

      let emails: string[] = []
      const raw = (req.body?.emails ?? req.body?.email ?? req.body) as any
      if (Array.isArray(raw)) emails = raw
      else if (typeof raw === 'string') emails = raw.split(/[\s,;]/)
      else if (raw && typeof raw === 'object' && Array.isArray(raw.emails)) emails = raw.emails

      emails = Array.from(
        new Set(
          emails
            .map(s =>
              String(s || '')
                .trim()
                .toLowerCase()
            )
            .filter(Boolean)
        )
      )
      if (!emails.length) return res.badRequest('emails 不能为空', { code: CODES.VALIDATION_ERROR })

      const pairs = await OrgUserRepository.findUserIdsByEmails(emails)
      const foundIds = pairs.map(p => p.id)
      const matched = pairs.length
      const foundEmailsSet = new Set(pairs.map(p => p.email?.toLowerCase()))
      const not_found = emails.filter(e => !foundEmailsSet.has(e))

      if (!foundIds.length) {
        // 没有任何匹配的邮箱
        return res.fail(CODES.NOT_FOUND, 404, '未找到任何邮箱对应的用户', {
          meta: { added: 0, matched: 0, not_found },
        })
      }

      const addRet = await svc.addUsers({ id: req.user?.id, username: req.user?.username }, orgId, foundIds, {
        ip: req.ip,
        ua: req.get('User-Agent') || undefined,
      })

      return res.created({ added: addRet.added, matched, not_found }, '按邮箱添加成功')
    } catch (e: any) {
      return res.internal(e?.message || '按邮箱添加机构用户失败', { code: CODES.INTERNAL_ERROR })
    }
  },

  async removeUser(req: AuthRequest, res: Response<ApiResponse<{ message: string }>>) {
    try {
      const orgId = Number(req.params.orgId)
      const userId = Number(req.params.userId)
      if (![orgId, userId].every(Number.isFinite)) {
        return res.badRequest('无效的参数', { code: CODES.VALIDATION_ERROR })
      }

      const data = await svc.removeUser({ id: req.user?.id, username: req.user?.username }, orgId, userId, {
        ip: req.ip,
        ua: req.get('User-Agent') || undefined,
      })
      return res.ok(data, '移除成功')
    } catch (e: any) {
      const msg = e?.message || '移除机构用户失败'
      if (/主组织|不在此组织/.test(msg)) return res.badRequest(msg, { code: CODES.VALIDATION_ERROR })
      return res.internal(msg, { code: CODES.INTERNAL_ERROR })
    }
  },

  async setPrimary(req: AuthRequest, res: Response<ApiResponse<{ user_id: number; org_id: number }>>) {
    try {
      const orgId = Number(req.params.orgId ?? req.body?.orgId)
      const userId = Number(req.params.userId)
      if (![orgId, userId].every(Number.isFinite)) {
        return res.badRequest('无效的参数', { code: CODES.VALIDATION_ERROR })
      }

      const data = await svc.setPrimary({ id: req.user?.id, username: req.user?.username }, orgId, userId, {
        ip: req.ip,
        ua: req.get('User-Agent') || undefined,
      })
      return res.ok(data, '已设置主组织')
    } catch (e: any) {
      const msg = e?.message || '设置主组织失败'
      if (/不存在|失败/.test(msg)) return res.badRequest(msg, { code: CODES.VALIDATION_ERROR })
      return res.internal(msg, { code: CODES.INTERNAL_ERROR })
    }
  },

  async moveUser(
    req: AuthRequest,
    res: Response<ApiResponse<{ user_id: number; from_org_id: number; to_org_id: number }>>
  ) {
    try {
      const fromOrgId = Number(req.params.fromOrgId)
      const toOrgId = Number(req.params.toOrgId)
      const userId = Number(req.params.userId)
      if (![fromOrgId, toOrgId, userId].every(Number.isFinite)) {
        return res.badRequest('无效的参数', { code: CODES.VALIDATION_ERROR })
      }

      const data = await svc.moveUser({ id: req.user?.id, username: req.user?.username }, fromOrgId, toOrgId, userId, {
        ip: req.ip,
        ua: req.get('User-Agent') || undefined,
      })
      return res.ok(data, '移动成功')
    } catch (e: any) {
      const msg = e?.message || '移动用户部门失败'
      if (/相同|不存在|失败/.test(msg)) return res.badRequest(msg, { code: CODES.VALIDATION_ERROR })
      return res.internal(msg, { code: CODES.INTERNAL_ERROR })
    }
  },
}

export default OrgUserController
