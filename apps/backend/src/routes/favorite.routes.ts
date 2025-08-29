// apps/backend/src/routes/favorite.routes.ts
import { Router, type RequestHandler, type Response } from 'express'
import { FavoriteController } from '../controllers/favorite.controller.js'
import { authenticateToken } from '../middleware/auth.middleware.js'
import type { AuthRequest } from '../types/auth.js'

const router = Router()

/**
 * 将 (req: AuthRequest, res: Response) 控制器包装为 Express RequestHandler，
 * 既兼容类型，又统一捕获异步错误。
 */
const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

// 获取收藏列表
router.get('/', authenticateToken, wrap(FavoriteController.list))

// 添加收藏
router.post('/', authenticateToken, wrap(FavoriteController.add))

// 删除收藏
router.delete('/:questionId', authenticateToken, wrap(FavoriteController.remove))

export { router as favoriteRoutes }
