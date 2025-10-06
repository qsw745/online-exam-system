// apps/backend/src/modules/tasks/controllers/task.controller.ts
import type { Response } from 'express'
import type { AuthRequest } from '@/types/auth.js'
import type { ApiResponse } from '@/types/response.js'
import { TaskService } from '../services/task.service.js'
import type { TaskStatus } from '../domain/task.model'
import { log } from '@/infrastructure/logging/logger'

const svc = new TaskService()
// ✅ 本地增强类型（与中间件一致）
type Res<T = any> = Response<T> & {
  ok<D = any>(data?: D, message?: string, extra?: any): Res<T>
  created<D = any>(data?: D, message?: string, extra?: any): Res<T>
  badRequest(message?: string, extra?: any): Res<T>
  unauthorized(message?: string, extra?: any): Res<T>
  forbidden(message?: string, extra?: any): Res<T>
  notFound(message?: string, extra?: any): Res<T>
  tooMany(message?: string, extra?: any): Res<T>
  internal(message?: string, extra?: any): Res<T>
  fail(code: string, httpStatus?: number, message?: string, extra?: any): Res<T>
}
type TaskListResponse = ApiResponse<{
    tasks: any[]
    pagination: { page: number; limit: number; total: number; totalPages: number }
}>
type TaskDetailResponse = ApiResponse<{ task: any }>
type ExamPayloadResponse = ApiResponse<{
    taskId: number
    examId: number
    paperId: number
    duration: number
    status: 'in_progress' | 'not_started' | 'submitted'
    startedAt?: string | null
    endTime?: string | null
    title: string
    description?: string | null
    questions: Array<{
        id: number
        type: string
        content: string
        options?: any
        score: number
        order: number
    }>
}>

export class TaskController {
  static async listMine(req: AuthRequest, res: Res<TaskListResponse>) {
    try {
      const userId = req.user?.id
      if (!userId) return res.unauthorized()

      const page = Math.max(1, parseInt(String(req.query.page ?? '1')) || 1)
      const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit ?? '10')) || 10))
      const search = (req.query.search as string) || ''
      const status = (req.query.status as TaskStatus | '') || ''

      const result = await svc.list({ page, limit, search, status, userId, userRole: 'student' })
      return res.ok({
        tasks: result.tasks,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / result.limit),
        },
      })
    } catch (e: any) {
      log.error('获取我的任务列表错误:', e)
      return res.internal(e?.message || '获取我的任务失败')
    }
  }

  static async list(req: AuthRequest, res: Res<TaskListResponse>) {
    try {
      const userId = req.user?.id
      const role = req.user?.role as 'admin' | 'teacher' | 'student' | undefined
      if (!userId || !role) return res.unauthorized()

      const page = Math.max(1, parseInt(String(req.query.page ?? '1')) || 1)
      const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit ?? '10')) || 10))
      const search = (req.query.search as string) || ''
      const status = (req.query.status as TaskStatus | '') || ''

      const result = await svc.list({ page, limit, search, status, userId, userRole: role })
      return res.ok({
        tasks: result.tasks,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / result.limit),
        },
      })
    } catch (e: any) {
      log.error('获取任务列表错误:', e)
      return res.internal(e?.message || '获取任务列表失败')
    }
  }

  static async get(req: AuthRequest, res: Res<TaskDetailResponse>) {
    try {
      const userId = req.user?.id
      const role = req.user?.role as 'admin' | 'teacher' | 'student' | undefined
      if (!userId || !role) return res.unauthorized()

      const taskId = Number(req.params.id)
      if (!Number.isFinite(taskId)) return res.badRequest('无效的任务ID')

      const task = await svc.get(taskId, userId, role)
      if (!task) return res.notFound('任务不存在或无权限访问')

      return res.ok({ task })
    } catch (e: any) {
      log.error('获取任务详情错误:', e)
      return res.internal(e?.message || '获取任务详情失败')
    }
  }

  /** 🔥 开始/继续考试（支持把 path 中的 id 当作 taskId 或 examId） */
  static async getExam(req: AuthRequest, res: Res<ExamPayloadResponse>) {
    try {
      const userId = req.user?.id
      const role = (req.user?.role as 'admin' | 'teacher' | 'student' | undefined) ?? 'student'
      if (!userId) return res.unauthorized()

      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.badRequest('无效的ID')

      const payload = await svc.getExam(id, userId, role)
      return res.ok(payload)
    } catch (e: any) {
      log.error('获取考试内容错误:', e)
      const msg = e?.message || '获取考试内容失败'
      if (/不存在|无权限|未关联|未开始|已结束|已提交/i.test(msg)) {
        return res.badRequest(msg)
      }
      return res.internal(msg)
    }
  }

  static async create(req: AuthRequest, res: Res<TaskDetailResponse>) {
    try {
      const creatorId = req.user?.id
      const role = req.user?.role
      if (!creatorId) return res.unauthorized()
      if (role !== 'admin' && role !== 'teacher') return res.forbidden('只有管理员和教师可以创建任务')
      if (!req.body?.title) return res.badRequest('任务标题不能为空')

      const assigned_user_ids = Array.isArray(req.body.assigned_user_ids) ? req.body.assigned_user_ids : []
      const assigned_department_ids = Array.isArray(req.body.assigned_department_ids)
        ? req.body.assigned_department_ids
        : []

      const task = await svc.create({
        creatorId,
        title: req.body.title,
        description: req.body.description,
        status: req.body.status,
        start_time: req.body.start_time,
        end_time: req.body.end_time,
        paper_id: req.body.paper_id ? Number(req.body.paper_id) : undefined,
        exam_id: req.body.exam_id ? Number(req.body.exam_id) : undefined,
        type: req.body.type || 'practice',
        assigned_user_ids,
        assigned_department_ids,
      })
      return res.created({ task }, '创建成功')
    } catch (e: any) {
      const msg = e?.message || ''
      if (/分配用户不存在|无效的分配用户|assigned user/i.test(msg)) {
        return res.badRequest(msg)
      }
      return res.internal(msg || '创建任务失败')
    }
  }

  static async update(req: AuthRequest, res: Res<TaskDetailResponse>) {
    try {
      const userId = req.user?.id
      const role = req.user?.role as 'admin' | 'teacher' | 'student' | undefined
      if (!userId || !role) return res.unauthorized()

      const taskId = Number(req.params.id)
      if (!Number.isFinite(taskId)) return res.badRequest('无效的任务ID')

      const task = await svc.update(
        taskId,
        { userId, role },
        {
          title: req.body.title,
          description: req.body.description,
          status: req.body.status,
          start_time: req.body.start_time,
          end_time: req.body.end_time,
          assigned_user_ids: Array.isArray(req.body.assigned_user_ids) ? req.body.assigned_user_ids : undefined,
          assigned_department_ids: Array.isArray(req.body.assigned_department_ids)
            ? req.body.assigned_department_ids
            : undefined,
        }
      )
      return res.ok({ task }, '更新成功')
    } catch (e: any) {
      log.error('更新任务错误:', e)
      return res.internal(e?.message || '更新任务失败')
    }
  }

  static async delete(req: AuthRequest, res: Res<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      const role = req.user?.role as 'admin' | 'teacher' | 'student' | undefined
      if (!userId || !role) return res.unauthorized()

      const taskId = Number(req.params.id)
      if (!Number.isFinite(taskId)) return res.badRequest('无效的任务ID')

      await svc.remove(taskId, { userId, role })
      return res.ok(null, '删除成功')
    } catch (e: any) {
      log.error('删除任务错误:', e)
      return res.internal(e?.message || '删除任务失败')
    }
  }

  static async submit(req: AuthRequest, res: Res<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      if (!userId) return res.unauthorized()

      const taskId = Number(req.params.id)
      if (!Number.isFinite(taskId)) return res.badRequest('无效的任务ID')

      await svc.submit(taskId, userId, { answers: req.body?.answers || {}, time_spent: req.body?.time_spent })
      return res.ok(null, '提交成功')
    } catch (e: any) {
      log.error('提交任务错误:', e)
      return res.internal(e?.message || '提交任务失败')
    }
  }

  static async publish(req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const user = req.user
      if (!user?.id) return res.unauthorized()
      const taskId = Number(req.params.id)
      if (!Number.isFinite(taskId)) return res.badRequest('无效的任务ID')

      await svc.publish(taskId, { id: user.id, role: user.role as any })
      return res.ok({ taskId }, '任务发布成功')
    } catch (e: any) {
      log.error('发布任务错误:', e)
      return res.internal(e?.message || '发布任务失败')
    }
  }

  static async unpublish(req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const user = req.user
      if (!user?.id) return res.unauthorized()
      const taskId = Number(req.params.id)
      if (!Number.isFinite(taskId)) return res.badRequest('无效的任务ID')

      await svc.unpublish(taskId, { id: user.id, role: user.role as any }, req.body?.reason)
      return res.ok({ taskId }, '任务下线成功')
    } catch (e: any) {
      log.error('下线任务错误:', e)
      return res.internal(e?.message || '下线任务失败')
    }
  }

  static async batchPublish(req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const user = req.user
      if (!user?.id) return res.unauthorized()
      const ids: number[] = Array.isArray(req.body?.taskIds) ? req.body.taskIds : []
      if (!ids.length) return res.badRequest('请提供有效的任务ID列表')

      const r = await svc.batchPublish(ids, { id: user.id, role: user.role as any })
      return res.ok({ ...r }, '批量发布完成')
    } catch (e: any) {
      log.error('批量发布任务错误:', e)
      return res.internal(e?.message || '批量发布任务失败')
    }
  }

  static async batchUnpublish(req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const user = req.user
      if (!user?.id) return res.unauthorized()
      const ids: number[] = Array.isArray(req.body?.taskIds) ? req.body.taskIds : []
      if (!ids.length) return res.badRequest('请提供有效的任务ID列表')

      const r = await svc.batchUnpublish(ids, { id: user.id, role: user.role as any })
      return res.ok({ ...r }, '批量下线完成')
    } catch (e: any) {
      log.error('批量下线任务错误:', e)
      return res.internal(e?.message || '批量下线任务失败')
    }
  }
}
