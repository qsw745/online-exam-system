import { Router, type RequestHandler, type Response } from 'express'
import { authenticateToken } from '@/common/middleware/auth.js'
import type { AuthRequest } from '@/types/auth.js'
import { ResultController } from '../controllers/result.controller.js'

const router = Router()

const wrap =
    (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
        (req, res, next) => {
            Promise.resolve(handler(req as AuthRequest, res)).catch(next)
        }

// 列表 / 详情（支持 ?include=questions | include_questions=true）
router.get('/', authenticateToken, wrap(ResultController.list))
router.get('/:id', authenticateToken, wrap(ResultController.getById))

export { router as resultRoutes }
export default router
