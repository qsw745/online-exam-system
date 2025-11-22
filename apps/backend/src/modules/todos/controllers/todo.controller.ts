// apps/backend/src/modules/todos/controllers/todo.controller.ts
import type { AuthRequest } from '@/types/auth.js'
import type { Res } from '@/types/response.js'
import type { ITodo, TodoListData, PendingCountData } from '../domain/todo.model'
import { TodoService } from '../services/todo.service.js'

export class TodoController {
  static async create(req: AuthRequest, res: Res) {
    try {
      const uid = req.user?.id
      if (!uid) return res.unauthorized('未授权访问')
      const { user_id, title, content, source, target_path, metadata } = req.body
      const data = await TodoService.create(uid, { user_id, title, content, source, target_path, metadata })
      return res.ok<ITodo>(data)
    } catch (e: any) {
      return res.internal(e?.message || '创建待办失败')
    }
  }

  static async createBatch(req: AuthRequest, res: Res) {
    try {
      const uid = req.user?.id
      if (!uid) return res.unauthorized('未授权访问')
      const { user_ids, title, content, source, target_path, metadata } = req.body
      const data = await TodoService.createBatch(uid, { user_ids, title, content, source, target_path, metadata })
      return res.ok<{ count: number }>(data)
    } catch (e: any) {
      return res.internal(e?.message || '批量创建待办失败')
    }
  }

  static async list(req: AuthRequest, res: Res) {
    try {
      const uid = req.user?.id
      if (!uid) return res.unauthorized('未授权访问')
      const data = await TodoService.list(uid)
      return res.ok<TodoListData>(data)
    } catch (e: any) {
      return res.internal(e?.message || '获取待办列表失败')
    }
  }

  static async pendingCount(req: AuthRequest, res: Res) {
    try {
      const uid = req.user?.id
      if (!uid) return res.unauthorized('未授权访问')
      const data = await TodoService.pendingCount(uid)
      return res.ok<PendingCountData>(data)
    } catch (e: any) {
      return res.internal(e?.message || '获取待办数量失败')
    }
  }

  static async markDone(req: AuthRequest, res: Res) {
    try {
      const uid = req.user?.id
      const id = Number(req.params.id)
      if (!uid) return res.unauthorized('未授权访问')
      if (Number.isNaN(id)) return res.badRequest('无效的待办ID')
      const ok = await TodoService.markDone(uid, id)
      if (!ok) return res.notFound('待办不存在')
      return res.ok<null>(null, '已标记完成')
    } catch (e: any) {
      return res.internal(e?.message || '标记完成失败')
    }
  }

  static async markAllDone(req: AuthRequest, res: Res) {
    try {
      const uid = req.user?.id
      if (!uid) return res.unauthorized('未授权访问')
      const data = await TodoService.markAllDone(uid)
      return res.ok<{ count: number }>(data)
    } catch (e: any) {
      return res.internal(e?.message || '批量标记完成失败')
    }
  }

  static async delete(req: AuthRequest, res: Res) {
    try {
      const uid = req.user?.id
      const id = Number(req.params.id)
      if (!uid) return res.unauthorized('未授权访问')
      if (Number.isNaN(id)) return res.badRequest('无效的待办ID')
      const ok = await TodoService.remove(uid, id)
      if (!ok) return res.notFound('待办不存在')
      return res.ok<null>(null, '删除成功')
    } catch (e: any) {
      return res.internal(e?.message || '删除待办失败')
    }
  }

  // ---- admin
  static async adminList(req: AuthRequest, res: Res) {
    try {
      const uid = req.user?.id
      if (!uid) return res.unauthorized('未授权访问')
      const data = (await TodoService.adminList(uid)) as unknown as ITodo[]
      return res.ok<ITodo[]>(data)
    } catch (e: any) {
      return res.internal(e?.message || '获取待办列表失败')
    }
  }

  static async adminDelete(req: AuthRequest, res: Res) {
    try {
      const uid = req.user?.id
      const id = Number(req.params.id)
      if (!uid) return res.unauthorized('未授权访问')
      if (Number.isNaN(id)) return res.badRequest('无效的待办ID')
      const ok = await TodoService.adminDelete(uid, id)
      if (!ok) return res.notFound('待办不存在')
      return res.ok<null>(null, '删除成功')
    } catch (e: any) {
      return res.internal(e?.message || '删除待办失败')
    }
  }
}
