import { Router, type Request, type Response, type NextFunction, type RequestHandler } from 'express'
import { authenticateToken } from '../../common/middleware/auth.js'
import { requireRoleByIds } from '../../common/middleware/role-auth.js'
import { ROLE_IDS } from '../../config/roles.js'

// 如果你已经有 TaskController，这里换成 import { TaskController } from './task.controller.js'
// 我先给一个内联的最小实现，方便你马上能跑通：
const TaskController = {
  async list(req: Request, res: Response) {
    // 处理分页/排序查询参数（全部可选）
    const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit ?? '10'), 10) || 10))
    const sort = String(req.query.sort ?? 'start_time') as 'start_time' | 'end_time' | 'created_at'
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1)

    // TODO: 替换为真实的 service 查询
    // 这里返回一个固定结构，保证前端能跑通
    res.json({
      success: true,
      data: {
        items: [],
        page,
        pageSize: limit,
        total: 0,
        sort,
      },
    })
  },
}

const router = Router()

/** 统一包装异步函数 */
const wrap =
  (handler: (req: Request, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req, res)).catch(next)
  }

// 登录校验
router.use(authenticateToken)

/**
 * GET /tasks
 * 任务列表（允许：老师/管理员/超管）
 * 注意：这里没有任何 `:id` 动态段，避免触发“无效的角色ID”等其它路由的参数解析分支
 */
router.get('/', requireRoleByIds([ROLE_IDS.TEACHER, ROLE_IDS.ADMIN, ROLE_IDS.SUPER_ADMIN]), wrap(TaskController.list))

export { router as taskRoutes }
