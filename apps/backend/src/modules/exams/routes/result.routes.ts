import { Router, type RequestHandler, type NextFunction, type Response } from 'express'
import { ResultController } from '../controllers/result.controller'
import { authenticateToken } from '@/common/middleware/auth'
import type { AuthRequest } from 'types/auth'

/**
 * 为了兼容前端既可能请求 /results 也可能请求 /exam_results，
 * 这里做一个“聚合路由”，在 /api 下均可使用这两个前缀访问相同能力。
 *
 * 挂载方式（不需要改动现有 app.ts）：
 *   app.use('/api', resultRoutes)
 */
const wrap =
    (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
        (req, res, next: NextFunction) => {
            Promise.resolve(handler(req as AuthRequest, res)).catch(next)
        }

function createCoreRouter() {
    const r = Router()
    r.use(authenticateToken)
    r.get('/', wrap(ResultController.list))
    r.get('/:id', wrap(ResultController.getById))
    return r
}

const core = createCoreRouter()
const router = Router()

// ✅ 两个基路径都可用
router.use('/', core)
router.use('/exam_results', core)

export { router as resultRoutes }
export default router
