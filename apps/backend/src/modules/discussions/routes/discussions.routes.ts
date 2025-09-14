import { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express'
import { body, param, query } from 'express-validator'
import { DiscussionsController } from '../controllers/discussions.controller'
import { authenticateToken } from '@/common/middleware/auth'
import { validateRequest } from '@/common/middleware/validation'
import type { AuthRequest } from '@/types/auth'

const router = Router()

const wrap =
    (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
        (req: Request, res: Response, next: NextFunction) => {
            Promise.resolve(handler(req as AuthRequest, res)).catch(next)
        }

router.use(authenticateToken)

/** 列表 */
router.get(
    '/',
    [
        query('keyword').optional().isString().isLength({ max: 200 }),
        query('page').optional().isInt({ min: 1 }),
        query('limit').optional().isInt({ min: 1, max: 100 }),
        query('category_id').optional().isString(),
        query('sort').optional().isString(),
    ],
    validateRequest,
    wrap(DiscussionsController.getDiscussions)
)

/** ⚠️ 一定放在 /:id 前，避免被 :id 吞掉 */
router.get('/categories/list', wrap(DiscussionsController.getCategories))

/** 详情 */
router.get('/:id', [param('id').isInt({ min: 1 })], validateRequest, wrap(DiscussionsController.getDiscussionDetail))

/** 创建帖子 */
router.post(
    '/',
    [
        body('title').isString().isLength({ min: 1, max: 200 }),
        body('content').isString().isLength({ min: 1 }),
        body('category_id').isInt({ min: 1 }),
        body('question_id').optional().isInt({ min: 1 }),
        body('tags').optional().isArray(),
    ],
    validateRequest,
    wrap(DiscussionsController.createDiscussion)
)

/** —— 对齐前端：获取某帖的回复列表（GET /discussions/:id/replies） —— */
router.get(
    '/:id/replies',
    [param('id').isInt({ min: 1 })],
    validateRequest,
    wrap(DiscussionsController.getReplies) // ⬅️ 新增
)

/** 创建回复（保持原有） */
router.post(
    '/:id/replies',
    [param('id').isInt({ min: 1 }), body('content').isString().isLength({ min: 1 })],
    validateRequest,
    wrap(DiscussionsController.createReply)
)

/** 点赞帖子 */
router.post('/:id/like', [param('id').isInt({ min: 1 })], validateRequest, wrap(DiscussionsController.toggleLike))

/** —— 对齐前端：点赞“回复”（POST /discussions/replies/:replyId/like） —— */
router.post(
    '/replies/:replyId/like',
    [param('replyId').isInt({ min: 1 })],
    validateRequest,
    wrap(DiscussionsController.toggleReplyLike) // ⬅️ 新增
)

/** 收藏帖子 */
router.post('/:id/bookmark', [param('id').isInt({ min: 1 })], validateRequest, wrap(DiscussionsController.toggleBookmark))

/** 删除帖子 */
router.delete('/:id', [param('id').isInt({ min: 1 })], validateRequest, wrap(DiscussionsController.deleteDiscussion))

/** 管理增强 */
router.post('/:id/mark-solution/:replyId', [param('id').isInt(), param('replyId').isInt()], validateRequest, wrap(DiscussionsController.markAsSolution))
router.post('/:id/pin', [param('id').isInt()], validateRequest, wrap(DiscussionsController.togglePin))
router.post('/:id/lock', [param('id').isInt()], validateRequest, wrap(DiscussionsController.toggleLock))
router.post('/:id/featured', [param('id').isInt()], validateRequest, wrap(DiscussionsController.toggleFeatured))

/** —— 对齐前端：浏览+1（POST /discussions/:id/view） —— */
router.post('/:id/view', [param('id').isInt({ min: 1 })], validateRequest, wrap(DiscussionsController.viewed)) // ⬅️ 新增

/** 兼容旧路径 */
router.get('/meta/categories', wrap(DiscussionsController.getCategories))
router.get('/meta/popular-tags', wrap(DiscussionsController.getPopularTags))

/** 个人统计 */
router.get('/me/stats', wrap(DiscussionsController.getUserStats))

export { router as discussionsRoutes }
export default router
