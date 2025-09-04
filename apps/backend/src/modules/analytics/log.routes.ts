// apps/backend/src/modules/analytics/log.routes.ts
import { Router, type RequestHandler, type Response } from 'express'

// 同目录下控制器
import { LogController } from './log.controller.js'

// 中间件：鉴权 & 角色
import { authenticateToken } from '@common/middleware/auth.js'
import { requireRole } from '@common/middleware/role-auth.js'

// 类型
import type { AuthRequest } from 'types/auth.js'

const router = Router()

/** 如果你的管理员角色 ID 不是 1，请改成真实的数字 ID */
const ADMIN_ROLE_ID = 1

/** 将 (req: AuthRequest, res: Response) 控制器包装为 Express RequestHandler，并统一捕获异步错误 */
const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

// 所有日志路由都需要认证
router.use(authenticateToken)

// 通用日志接口
router.get('/', wrap(LogController.getLogs))
router.get('/export', wrap(LogController.exportLogs))

// 用户操作日志
router.get('/user', wrap(LogController.getUserLogs))

// 系统日志（仅管理员）
router.get('/system', requireRole([ADMIN_ROLE_ID]), wrap(LogController.getSystemLogs))

// 审计日志（仅管理员）
router.get('/audit', requireRole([ADMIN_ROLE_ID]), wrap(LogController.getAuditLogs))

// 登录日志
router.get('/login', wrap(LogController.getLoginLogs))

// 某场考试日志
router.get('/exam/:examId', wrap(LogController.getExamLogs))

// 清理过期日志（仅管理员）
router.post('/cleanup', requireRole([ADMIN_ROLE_ID]), wrap(LogController.cleanupLogs))

export default router
