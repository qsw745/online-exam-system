// apps/backend/src/modules/notifications/discussions.routes.ts
import { Router, type Request, type Response, type NextFunction, type RequestHandler } from 'express'
import { body, param, query } from 'express-validator'

// 控制器（ESM 需显式 .js 扩展名）
import { DiscussionsController } from './discussions.controller.js'
const discussionsController = new DiscussionsController()

// 公共中间件（从 modules 返回到 common/middleware；ESM 需 .js）
import { validateRequest } from '../../common/middleware/validation.js'
import { authenticateToken } from '../../common/middleware/auth.js'

// 类型（从 modules 返回到 types；ESM 需 .js）
import type { AuthRequest } from '../../types/auth.js'

const router = Router()

/** 统一包装控制器回调，捕获异步错误并保留类型 */
const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

/**
 * 控制器方法名的联合类型（包含主方法名 + 兼容的别名）
 * 根据你实际的 controller 方法，按需增删
 */
type ControllerMethod =
  | 'getDiscussions'
  | 'list'
  | 'createDiscussion'
  | 'create'
  | 'getDiscussionDetail'
  | 'getDiscussionById'
  | 'getById'
  | 'createReply'
  | 'replyDiscussion'
  | 'addReply'
  | 'toggleLike'
  | 'likeDiscussion'
  | 'like'
  | 'markAsRead'
  | 'read'
  | 'getMyDiscussions'
  | 'mine'
  | 'deleteDiscussion'
  | 'remove'
  | 'getCategories'
  | 'getPopularTags'
  | 'getUserStats'

/** 调用指定方法，若不存在则返回 501 */
const call = (method: ControllerMethod): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    const fn = (discussionsController as any)[method]
    if (typeof fn !== 'function') {
      return res.status(501).json({
        success: false,
        error: 'NOT_IMPLEMENTED',
        message: `Controller method "${String(method)}" is not implemented.`,
      })
    }
    return Promise.resolve(fn.call(discussionsController, req, res)).catch(next)
  }
}

/** 先尝试 primary，不存在再尝试 fallback；都没有则 501 */
const tryCall = (primary: ControllerMethod, fallback?: ControllerMethod): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    const tryInvoke = (name: ControllerMethod) => {
      const fn = (discussionsController as any)[name]
      if (typeof fn === 'function') {
        return Promise.resolve(fn.call(discussionsController, req, res))
      }
      return null
    }

    const p = tryInvoke(primary)
    if (p) return p.catch(next)

    if (fallback) {
      const f = tryInvoke(fallback)
      if (f) return f.catch(next)
    }

    return res.status(501).json({
      success: false,
      error: 'NOT_IMPLEMENTED',
      message: `Controller methods "${primary}"${fallback ? ` / "${fallback}"` : ''} are not implemented.`,
    })
  }
}

// 全局鉴权（如需公开某些路由，可在对应路由前移除或改 optionalAuth）
router.use(authenticateToken)

/**
 * 列表/查询讨论：GET /api/notifications/discussions?keyword=&page=&limit=
 * 期望控制器方法：getDiscussions 或 list
 */
router.get(
  '/',
  [
    query('keyword').optional().isString().isLength({ max: 200 }).withMessage('keyword 长度不能超过 200'),
    query('page').optional().isInt({ min: 1 }).withMessage('page 必须为正整数'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit 必须在 1~100'),
  ],
  validateRequest,
  tryCall('getDiscussions', 'list')
)

/**
 * 创建讨论：POST /api/notifications/discussions
 * 期望控制器：createDiscussion 或 create
 */
router.post(
  '/',
  [
    body('title').isString().isLength({ min: 1, max: 200 }).withMessage('title 必须为 1~200 长度的字符串'),
    body('content').isString().isLength({ min: 1 }).withMessage('content 必须为非空字符串'),
    body('tags').optional().isArray().withMessage('tags 必须为数组'),
  ],
  validateRequest,
  tryCall('createDiscussion', 'create')
)

/**
 * 获取讨论详情：GET /api/notifications/discussions/:id
 * 期望控制器：getDiscussionById 或 getById（或你也可在 controller 中实现 getDiscussionDetail）
 */
router.get(
  '/:id',
  [param('id').isInt({ min: 1 }).withMessage('id 必须为正整数')],
  validateRequest,
  // 尝试常见三种命名
  tryCall('getDiscussionById', 'getById')
)

/**
 * 回复讨论：POST /api/notifications/discussions/:id/replies
 * 期望控制器：replyDiscussion / addReply / createReply
 */
router.post(
  '/:id/replies',
  [
    param('id').isInt({ min: 1 }).withMessage('id 必须为正整数'),
    body('content').isString().isLength({ min: 1 }).withMessage('content 必须为非空字符串'),
  ],
  validateRequest,
  // 先尝试 replyDiscussion，再 addReply，最后 createReply
  tryCall('replyDiscussion', 'addReply')
)

/**
 * 点赞：POST /api/notifications/discussions/:id/like
 * 期望控制器：likeDiscussion / like / toggleLike
 */
router.post(
  '/:id/like',
  [param('id').isInt({ min: 1 }).withMessage('id 必须为正整数')],
  validateRequest,
  tryCall('likeDiscussion', 'like')
)

/**
 * 标记已读：POST /api/notifications/discussions/:id/read
 * 期望控制器：markAsRead / read
 */
router.post(
  '/:id/read',
  [param('id').isInt({ min: 1 }).withMessage('id 必须为正整数')],
  validateRequest,
  tryCall('markAsRead', 'read')
)

/**
 * 我参与/我的讨论：GET /api/notifications/discussions/mine
 * 期望控制器：getMyDiscussions / mine
 */
router.get('/mine', [], validateRequest, tryCall('getMyDiscussions', 'mine'))

/**
 * 删除讨论（管理员或作者）：DELETE /api/notifications/discussions/:id
 * 期望控制器：deleteDiscussion / remove
 */
router.delete(
  '/:id',
  [param('id').isInt({ min: 1 }).withMessage('id 必须为正整数')],
  validateRequest,
  tryCall('deleteDiscussion', 'remove')
)

export default router
