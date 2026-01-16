/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AuthRequest } from '@/types/auth'
import type { Res } from '@/types/response'
import { CODES } from '@/types/response'
import { enqueueSystemTestJob, ensureSystemTestWorker, getSystemTestJob } from '../services/system-tests.queue'

ensureSystemTestWorker()

const allowedEnv = () => {
  const env = String(process.env.NODE_ENV || 'development').toLowerCase()
  return env !== 'production'
}

export class SystemTestsController {
  static async run(req: AuthRequest, res: Res) {
    try {
      if (!allowedEnv()) return res.fail('FORBIDDEN', 403, '仅允许在本地/测试环境执行')
      if (!req.user?.id) return res.unauthorized('未授权')
      const modules = Array.isArray(req.body?.modules) ? req.body.modules : undefined
      const iterations = Number(req.body?.iterations || 1)
      const job = await enqueueSystemTestJob({
        modules,
        iterations,
        user: { id: req.user.id, email: req.user.email },
      })
      return res.ok({ jobId: job.id }, 'OK')
    } catch (e: any) {
      return res.internal(e?.message || '创建测试任务失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async getJob(req: AuthRequest, res: Res) {
    try {
      if (!req.user?.id) return res.unauthorized('未授权')
      const jobId = String(req.params.id || '').trim()
      if (!jobId) return res.badRequest('缺少 jobId')
      const job = await getSystemTestJob(jobId)
      if (!job) return res.notFound('任务不存在')
      const state = await job.getState()
      const progress = job.progress
      const result = state === 'completed' ? job.returnvalue : undefined
      const failedReason = state === 'failed' ? job.failedReason : undefined
      return res.ok({ id: job.id, state, progress, result, failedReason }, 'OK')
    } catch (e: any) {
      return res.internal(e?.message || '查询任务失败', { code: CODES.INTERNAL_ERROR })
    }
  }
}
