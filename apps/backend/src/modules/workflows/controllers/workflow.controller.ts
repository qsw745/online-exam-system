import type { Response } from 'express'
import type { AuthRequest } from '@/types/auth'
import type { ApiResponse } from '@/types/response'
import { CODES } from '@/types/response'
import { WorkflowService } from '../services/workflow.service'
import { WorkflowRepository } from '../repositories/workflow.repository'
import { log } from '@/infrastructure/logging/logger'

const svc = new WorkflowService()

export class WorkflowController {
  static async listTemplates(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const data = await svc.listTemplates(req.user, req.query)
      return (res as any).ok({ items: data }, '获取模板成功')
    } catch (e: any) {
      const msg = e?.message || '获取模板失败'
      if (/未授权/.test(msg)) return (res as any).unauthorized(msg, { code: CODES.AUTH_UNAUTHORIZED })
      return (res as any).internal(msg, { code: CODES.INTERNAL_ERROR })
    }
  }

  static async getTemplate(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const id = Number(req.params.id)
      if (Number.isNaN(id)) return (res as any).badRequest('无效模板', { code: CODES.VALIDATION_ERROR })
      const template = await WorkflowRepository.getTemplate(id)
      if (!template) return (res as any).fail(CODES.NOT_FOUND, 404, '模板不存在')
      return (res as any).ok(template, '获取模板成功')
    } catch (e: any) {
      const msg = e?.message || '获取模板失败'
      return (res as any).internal(msg, { code: CODES.INTERNAL_ERROR })
    }
  }

  static async createTemplate(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const data = await svc.createTemplate(req.user, req.body || {})
      return (res as any).created(data, '创建模板成功')
    } catch (e: any) {
      const msg = e?.message || '创建模板失败'
      if (/未授权/.test(msg)) return (res as any).unauthorized(msg, { code: CODES.AUTH_UNAUTHORIZED })
      if (/无权限/.test(msg)) return (res as any).forbidden(msg, { code: CODES.AUTH_FORBIDDEN })
      if (/缺少/.test(msg)) return (res as any).badRequest(msg, { code: CODES.VALIDATION_ERROR })
      log.error('[workflow] create template failed', e)
      return (res as any).internal(msg, { code: CODES.INTERNAL_ERROR })
    }
  }

  static async updateTemplate(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const id = Number(req.params.id)
      if (Number.isNaN(id)) return (res as any).badRequest('无效模板', { code: CODES.VALIDATION_ERROR })
      const data = await svc.updateTemplate(req.user, id, req.body || {})
      return (res as any).ok(data, '更新模板成功')
    } catch (e: any) {
      const msg = e?.message || '更新模板失败'
      if (/未授权/.test(msg)) return (res as any).unauthorized(msg, { code: CODES.AUTH_UNAUTHORIZED })
      if (/无权限/.test(msg)) return (res as any).forbidden(msg, { code: CODES.AUTH_FORBIDDEN })
      if (/不存在/.test(msg)) return (res as any).fail(CODES.NOT_FOUND, 404, msg)
      return (res as any).internal(msg, { code: CODES.INTERNAL_ERROR })
    }
  }

  static async publishTemplate(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const id = Number(req.params.id)
      if (Number.isNaN(id)) return (res as any).badRequest('无效模板', { code: CODES.VALIDATION_ERROR })
      const data = await svc.publishTemplate(req.user, id)
      return (res as any).ok(data, '发布模板成功')
    } catch (e: any) {
      const msg = e?.message || '发布模板失败'
      if (/未授权/.test(msg)) return (res as any).unauthorized(msg, { code: CODES.AUTH_UNAUTHORIZED })
      if (/无权限/.test(msg)) return (res as any).forbidden(msg, { code: CODES.AUTH_FORBIDDEN })
      return (res as any).internal(msg, { code: CODES.INTERNAL_ERROR })
    }
  }

  static async startInstance(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const data = await svc.startInstance(req.user, req.body || {})
      return (res as any).created(data, '启动流程成功')
    } catch (e: any) {
      const msg = e?.message || '启动流程失败'
      if (/未授权/.test(msg)) return (res as any).unauthorized(msg, { code: CODES.AUTH_UNAUTHORIZED })
      if (/缺少|未找到|流程缺少/.test(msg)) return (res as any).badRequest(msg, { code: CODES.VALIDATION_ERROR })
      return (res as any).internal(msg, { code: CODES.INTERNAL_ERROR })
    }
  }

  static async getInstanceDetail(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const id = Number(req.params.id)
      if (Number.isNaN(id)) return (res as any).badRequest('无效流程实例', { code: CODES.VALIDATION_ERROR })
      const data = await svc.getInstanceDetail(req.user, id)
      return (res as any).ok(data, '获取流程详情成功')
    } catch (e: any) {
      const msg = e?.message || '获取流程详情失败'
      if (/未授权/.test(msg)) return (res as any).unauthorized(msg, { code: CODES.AUTH_UNAUTHORIZED })
      if (/不存在/.test(msg)) return (res as any).fail(CODES.NOT_FOUND, 404, msg)
      return (res as any).internal(msg, { code: CODES.INTERNAL_ERROR })
    }
  }

  static async listMyTasks(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const data = await svc.listMyTasks(req.user, req.query)
      return (res as any).ok(data, '获取我的任务成功')
    } catch (e: any) {
      const msg = e?.message || '获取任务失败'
      if (/未授权/.test(msg)) return (res as any).unauthorized(msg, { code: CODES.AUTH_UNAUTHORIZED })
      return (res as any).internal(msg, { code: CODES.INTERNAL_ERROR })
    }
  }

  static async approveTask(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const id = Number(req.params.id)
      if (Number.isNaN(id)) return (res as any).badRequest('无效任务', { code: CODES.VALIDATION_ERROR })
      const data = await svc.decideTask(req.user, id, 'approved', req.body?.comment, req.body?.form_values)
      return (res as any).ok(data, '审批通过')
    } catch (e: any) {
      const msg = e?.message || '审批失败'
      if (/未授权/.test(msg)) return (res as any).unauthorized(msg, { code: CODES.AUTH_UNAUTHORIZED })
      if (/无权限/.test(msg)) return (res as any).forbidden(msg, { code: CODES.AUTH_FORBIDDEN })
      if (/不存在|已处理/.test(msg)) return (res as any).badRequest(msg, { code: CODES.VALIDATION_ERROR })
      return (res as any).internal(msg, { code: CODES.INTERNAL_ERROR })
    }
  }

  static async rejectTask(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const id = Number(req.params.id)
      if (Number.isNaN(id)) return (res as any).badRequest('无效任务', { code: CODES.VALIDATION_ERROR })
      const data = await svc.decideTask(req.user, id, 'rejected', req.body?.comment, req.body?.form_values)
      return (res as any).ok(data, '审批驳回')
    } catch (e: any) {
      const msg = e?.message || '审批失败'
      if (/未授权/.test(msg)) return (res as any).unauthorized(msg, { code: CODES.AUTH_UNAUTHORIZED })
      if (/无权限/.test(msg)) return (res as any).forbidden(msg, { code: CODES.AUTH_FORBIDDEN })
      if (/不存在|已处理/.test(msg)) return (res as any).badRequest(msg, { code: CODES.VALIDATION_ERROR })
      return (res as any).internal(msg, { code: CODES.INTERNAL_ERROR })
    }
  }

  static async submitExamReview(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const examId = Number(req.params.id)
      if (Number.isNaN(examId)) return (res as any).badRequest('无效考试ID', { code: CODES.VALIDATION_ERROR })
      const data = await svc.submitExamReview(req.user, examId, req.body || {})
      return (res as any).ok(data, '提交审核成功')
    } catch (e: any) {
      const msg = e?.message || '提交审核失败'
      if (/未授权/.test(msg)) return (res as any).unauthorized(msg, { code: CODES.AUTH_UNAUTHORIZED })
      if (/不存在|权限/.test(msg)) return (res as any).fail(CODES.NOT_FOUND, 404, msg)
      if (/缺少/.test(msg)) return (res as any).badRequest(msg, { code: CODES.VALIDATION_ERROR })
      return (res as any).internal(msg, { code: CODES.INTERNAL_ERROR })
    }
  }
}

export default WorkflowController
