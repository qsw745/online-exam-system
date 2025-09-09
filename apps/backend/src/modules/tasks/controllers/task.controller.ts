// apps/backend/src/modules/tasks/controllers/task.controller.ts
import type { Response } from 'express'
import type { AuthRequest } from 'types/auth.js'
import type { ApiResponse } from 'types/response.js'
import { TaskService } from '../services/task.service.js'
import type { TaskStatus } from '../domain/task.entity.js'

const svc = new TaskService()

type TaskListResponse = ApiResponse<{
  tasks: any[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}>

type TaskDetailResponse = ApiResponse<{ task: any }>

export class TaskController {
  static async list(req: AuthRequest, res: Response<TaskListResponse>) {
    try {
      const userId = req.user?.id
      const role = req.user?.role as 'admin' | 'teacher' | 'student' | undefined
      if (!userId || !role) return res.status(401).json({ success: false, error: '未授权访问' })

      const page = Math.max(1, parseInt(String(req.query.page ?? '1')) || 1)
      const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit ?? '10')) || 10))
      const search = (req.query.search as string) || ''
      const status = (req.query.status as TaskStatus | '') || ''

      const result = await svc.list({ page, limit, search, status, userId, userRole: role })
      return res.json({
        success: true,
        data: {
          tasks: result.tasks,
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: Math.ceil(result.total / result.limit),
          },
        },
      })
    } catch (e: any) {
      console.error('获取任务列表错误:', e)
      return res.status(500).json({ success: false, error: e?.message || '获取任务列表失败' })
    }
  }

  static async get(req: AuthRequest, res: Response<TaskDetailResponse>) {
    try {
      const userId = req.user?.id
      const role = req.user?.role as 'admin' | 'teacher' | 'student' | undefined
      if (!userId || !role) return res.status(401).json({ success: false, error: '未授权访问' })

      const taskId = Number(req.params.id)
      if (!Number.isFinite(taskId)) return res.status(400).json({ success: false, error: '无效的任务ID' })

      const task = await svc.get(taskId, userId, role)
      if (!task) return res.status(404).json({ success: false, error: '任务不存在或无权限访问' })

      return res.json({ success: true, data: { task } })
    } catch (e: any) {
      console.error('获取任务详情错误:', e)
      return res.status(500).json({ success: false, error: e?.message || '获取任务详情失败' })
    }
  }

  static async create(req: AuthRequest, res: Response<TaskDetailResponse>) {
    try {
      const creatorId = req.user?.id
      const role = req.user?.role
      if (!creatorId) return res.status(401).json({ success: false, error: '未授权访问' })
      if (role !== 'admin' && role !== 'teacher') {
        return res.status(403).json({ success: false, error: '权限不足，只有管理员和教师可以创建任务' })
      }

      if (!req.body?.title) return res.status(400).json({ success: false, error: '任务标题不能为空' })

      const task = await svc.create({
        creatorId,
        title: req.body.title,
        description: req.body.description,
        status: req.body.status,
        start_time: req.body.start_time,
        end_time: req.body.end_time,
        exam_id: req.body.exam_id,
        type: req.body.type || 'practice',
        assigned_user_ids: req.body.assigned_user_ids,
      })
      return res.status(201).json({ success: true, data: { task } })
    } catch (e: any) {
      console.error('创建任务错误:', e)
      return res.status(500).json({ success: false, error: e?.message || '创建任务失败' })
    }
  }

  static async update(req: AuthRequest, res: Response<TaskDetailResponse>) {
    try {
      const userId = req.user?.id
      const role = req.user?.role as 'admin' | 'teacher' | 'student' | undefined
      if (!userId || !role) return res.status(401).json({ success: false, error: '未授权访问' })

      const taskId = Number(req.params.id)
      if (!Number.isFinite(taskId)) return res.status(400).json({ success: false, error: '无效的任务ID' })

      const task = await svc.update(
        taskId,
        { userId, role },
        {
          title: req.body.title,
          description: req.body.description,
          status: req.body.status,
          start_time: req.body.start_time,
          end_time: req.body.end_time,
        }
      )
      return res.json({ success: true, data: { task } })
    } catch (e: any) {
      console.error('更新任务错误:', e)
      return res.status(500).json({ success: false, error: e?.message || '更新任务失败' })
    }
  }

  static async delete(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      const role = req.user?.role as 'admin' | 'teacher' | 'student' | undefined
      if (!userId || !role) return res.status(401).json({ success: false, error: '未授权访问' })

      const taskId = Number(req.params.id)
      if (!Number.isFinite(taskId)) return res.status(400).json({ success: false, error: '无效的任务ID' })

      await svc.remove(taskId, { userId, role })
      return res.json({ success: true, data: null })
    } catch (e: any) {
      console.error('删除任务错误:', e)
      return res.status(500).json({ success: false, error: e?.message || '删除任务失败' })
    }
  }

  static async submit(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ success: false, error: '未授权访问' })

      const taskId = Number(req.params.id)
      if (!Number.isFinite(taskId)) return res.status(400).json({ success: false, error: '无效的任务ID' })

      await svc.submit(taskId, userId, { answers: req.body?.answers || {}, time_spent: req.body?.time_spent })
      return res.json({ success: true, data: null })
    } catch (e: any) {
      console.error('提交任务错误:', e)
      return res.status(500).json({ success: false, error: e?.message || '提交任务失败' })
    }
  }

  static async publish(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const user = req.user
      if (!user?.id) return res.status(401).json({ success: false, error: '未授权访问' })
      const taskId = Number(req.params.id)
      if (!Number.isFinite(taskId)) return res.status(400).json({ success: false, error: '无效的任务ID' })

      await svc.publish(taskId, { id: user.id, role: user.role as any })
      return res.json({ success: true, data: { message: '任务发布成功', taskId } })
    } catch (e: any) {
      console.error('发布任务错误:', e)
      return res.status(500).json({ success: false, error: e?.message || '发布任务失败' })
    }
  }

  static async unpublish(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const user = req.user
      if (!user?.id) return res.status(401).json({ success: false, error: '未授权访问' })
      const taskId = Number(req.params.id)
      if (!Number.isFinite(taskId)) return res.status(400).json({ success: false, error: '无效的任务ID' })

      await svc.unpublish(taskId, { id: user.id, role: user.role as any }, req.body?.reason)
      return res.json({ success: true, data: { message: '任务下线成功', taskId } })
    } catch (e: any) {
      console.error('下线任务错误:', e)
      return res.status(500).json({ success: false, error: e?.message || '下线任务失败' })
    }
  }

  static async batchPublish(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const user = req.user
      if (!user?.id) return res.status(401).json({ success: false, error: '未授权访问' })
      const ids: number[] = Array.isArray(req.body?.taskIds) ? req.body.taskIds : []
      if (!ids.length) return res.status(400).json({ success: false, error: '请提供有效的任务ID列表' })

      const r = await svc.batchPublish(ids, { id: user.id, role: user.role as any })
      return res.json({ success: true, data: { message: '批量发布完成', ...r } })
    } catch (e: any) {
      console.error('批量发布任务错误:', e)
      return res.status(500).json({ success: false, error: e?.message || '批量发布任务失败' })
    }
  }

  static async batchUnpublish(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const user = req.user
      if (!user?.id) return res.status(401).json({ success: false, error: '未授权访问' })
      const ids: number[] = Array.isArray(req.body?.taskIds) ? req.body.taskIds : []
      if (!ids.length) return res.status(400).json({ success: false, error: '请提供有效的任务ID列表' })

      const r = await svc.batchUnpublish(ids, { id: user.id, role: user.role as any })
      return res.json({ success: true, data: { message: '批量下线完成', ...r } })
    } catch (e: any) {
      console.error('批量下线任务错误:', e)
      return res.status(500).json({ success: false, error: e?.message || '批量下线任务失败' })
    }
  }
}
