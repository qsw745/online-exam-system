// apps/backend/src/modules/discussions/routes/discussions.routes.ts
import { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express'
import { body, param, query } from 'express-validator'
import { DiscussionsController } from '../controllers/discussions.controller'
import { authenticateToken } from '@common/middleware/auth'
import { validateRequest } from '@common/middleware/validation'
import type { AuthRequest } from 'types/auth'

const router = Router()

const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

router.use(authenticateToken)

// 列表
router.get(
  '/',
  [
    query('keyword').optional().isString().isLength({ max: 200 }),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validateRequest,
  wrap(DiscussionsController.getDiscussions)
)

// 创建帖子
router.post(
  '/',
  [
    body('title').isString().isLength({ min: 1, max: 200 }),
    body('content').isString().isLength({ min: 1 }),
    body('tags').optional().isArray(),
  ],
  validateRequest,
  wrap(DiscussionsController.createDiscussion)
)

// 详情
router.get('/:id', [param('id').isInt({ min: 1 })], validateRequest, wrap(DiscussionsController.getDiscussionDetail))

// 回复
router.post(
  '/:id/replies',
  [param('id').isInt({ min: 1 }), body('content').isString().isLength({ min: 1 })],
  validateRequest,
  wrap(DiscussionsController.createReply)
)

// 点赞 / 收藏
router.post('/:id/like', [param('id').isInt({ min: 1 })], validateRequest, wrap(DiscussionsController.toggleLike))
router.post(
  '/:id/bookmark',
  [param('id').isInt({ min: 1 })],
  validateRequest,
  wrap(DiscussionsController.toggleBookmark)
)

// 删除
router.delete('/:id', [param('id').isInt({ min: 1 })], validateRequest, wrap(DiscussionsController.deleteDiscussion))

// 管理增强
router.post(
  '/:id/mark-solution/:replyId',
  [param('id').isInt(), param('replyId').isInt()],
  validateRequest,
  wrap(DiscussionsController.markAsSolution)
)
router.post('/:id/pin', [param('id').isInt()], validateRequest, wrap(DiscussionsController.togglePin))
router.post('/:id/lock', [param('id').isInt()], validateRequest, wrap(DiscussionsController.toggleLock))
router.post('/:id/featured', [param('id').isInt()], validateRequest, wrap(DiscussionsController.toggleFeatured))

// 元数据 & 个人统计
router.get('/meta/categories', wrap(DiscussionsController.getCategories))
router.get('/meta/popular-tags', wrap(DiscussionsController.getPopularTags))
router.get('/me/stats', wrap(DiscussionsController.getUserStats))

export { router as discussionsRoutes }
export default router
