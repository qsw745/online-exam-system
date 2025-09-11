// apps/backend/src/modules/orgs/controllers/org.controller.ts
import type { Response } from 'express'
import type { AuthRequest } from '@/types/auth'
import type { ApiResponse } from '@/types/response'
import type { IOrg, OrgListData, OrgTreeNode } from '../domain/org.model'
import { OrgService } from '../services/org.service'

const svc = new OrgService()

export const OrgController = {
  async list(req: AuthRequest, res: Response<ApiResponse<OrgListData>>) {
    try {
      const page = Number(req.query.page ?? 1) || 1
      const limit = Math.min(100, Number(req.query.limit ?? 10) || 10)
      const search = (req.query.search as string | undefined)?.trim()
      const parentId =
        typeof req.query.parent_id !== 'undefined' && req.query.parent_id !== ''
          ? Number(req.query.parent_id)
          : undefined
      const includeInactive = req.query.include_inactive === '1' || req.query.include_inactive === 'true'
      const data = await svc.list({ page, limit, search, parentId, includeInactive })
      return res.json({ success: true, data })
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || '获取组织列表失败' })
    }
  },

  async getTree(req: AuthRequest, res: Response<ApiResponse<OrgTreeNode[]>>) {
    try {
      const includeInactive = req.query.include_inactive === '1' || req.query.include_inactive === 'true'
      const data = await svc.getTree(includeInactive)
      return res.json({ success: true, data })
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || '获取组织树失败' })
    }
  },

  async getById(req: AuthRequest, res: Response<ApiResponse<IOrg>>) {
    try {
      console.log('req.query', req.params)
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: '无效的组织ID' })
      const data = await svc.getById(id)
      return res.json({ success: true, data })
    } catch (e: any) {
      const code = /不存在/.test(e?.message) ? 404 : 500
      return res.status(code).json({ success: false, error: e?.message || '获取组织详情失败' })
    }
  },

  async create(req: AuthRequest, res: Response<ApiResponse<{ id: number }>>) {
    try {
      const data = await svc.create({ id: req.user?.id, username: req.user?.username }, req.body ?? {}, {
        ip: req.ip,
        ua: req.get('User-Agent') || undefined,
      })
      return res.status(201).json({ success: true, data })
    } catch (e: any) {
      const msg = e?.message || '创建组织失败'
      const code = /编码已存在|已存在/.test(msg) ? 409 : 500
      return res.status(code).json({ success: false, error: msg })
    }
  },

  async update(req: AuthRequest, res: Response<ApiResponse<IOrg>>) {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: '无效的组织ID' })
      const data = await svc.update({ id: req.user?.id, username: req.user?.username }, id, req.body ?? {}, {
        ip: req.ip,
        ua: req.get('User-Agent') || undefined,
      })
      return res.json({ success: true, data })
    } catch (e: any) {
      const msg = e?.message || '更新组织失败'
      const code = /不存在|不能将组织移动/.test(msg) ? 400 : 500
      return res.status(code).json({ success: false, error: msg })
    }
  },

  async delete(req: AuthRequest, res: Response<ApiResponse<{ message: string }>>) {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: '无效的组织ID' })
      const data = await svc.delete({ id: req.user?.id, username: req.user?.username }, id, {
        ip: req.ip,
        ua: req.get('User-Agent') || undefined,
      })
      return res.json({ success: true, data })
    } catch (e: any) {
      const msg = e?.message || '删除组织失败'
      const code = /不存在|子节点/.test(msg) ? 400 : 500
      return res.status(code).json({ success: false, error: msg })
    }
  },

  async move(req: AuthRequest, res: Response<ApiResponse<{ message: string }>>) {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: '无效的组织ID' })
      const parent_id =
        req.body?.parent_id === null || req.body?.parent_id === '' || req.body?.parent_id === undefined
          ? null
          : Number(req.body?.parent_id)
      const data = await svc.move({ id: req.user?.id, username: req.user?.username }, id, parent_id, {
        ip: req.ip,
        ua: req.get('User-Agent') || undefined,
      })
      return res.json({ success: true, data })
    } catch (e: any) {
      const msg = e?.message || '移动组织失败'
      const code = /不存在|不能将组织移动/.test(msg) ? 400 : 500
      return res.status(code).json({ success: false, error: msg })
    }
  },

  async batchSort(req: AuthRequest, res: Response<ApiResponse<{ message: string }>>) {
    try {
      const updates: Array<{ id: number; parent_id?: number | null }> = req.body?.updates ?? []
      const data = await svc.batchSort({ id: req.user?.id, username: req.user?.username }, updates, {
        ip: req.ip,
        ua: req.get('User-Agent') || undefined,
      })
      return res.json({ success: true, data })
    } catch (e: any) {
      const msg = e?.message || '批量更新失败'
      const code = /循环/.test(msg) ? 400 : 500
      return res.status(code).json({ success: false, error: msg })
    }
  },
}

export default OrgController
