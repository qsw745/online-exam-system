import { Router, type RequestHandler, type NextFunction, type Response } from 'express'
import { PaperController } from '../controllers/paper.controller'
import { authenticateToken, requireRole } from '@/common/middleware/auth'
import type { AuthRequest } from '@/types/auth'

const router = Router()
const requireRoleStr = requireRole as unknown as (roles: string[]) => RequestHandler

// 包装器：记录控制器名称，错误能打印出“是哪个控制器方法”
const wrap =
    (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
        (req, res, next: NextFunction) => {
            ;(req as any).__handlerName = handler.name || 'anonymous'
            Promise.resolve(handler(req as AuthRequest, res)).catch(next)
        }

router.use(authenticateToken)

router.get('/', wrap(PaperController.list))
router.get('/bank', wrap(PaperController.searchBank))
router.get('/:id', wrap(PaperController.getById))
router.post('/', requireRoleStr(['admin', 'teacher']), wrap(PaperController.create))
router.put('/:id', requireRoleStr(['admin', 'teacher']), wrap(PaperController.update))
router.put('/:id/workflow', requireRoleStr(['admin', 'teacher']), wrap(PaperController.updateWorkflow))
router.delete('/:id', requireRoleStr(['admin', 'teacher']), wrap(PaperController.delete))

router.post('/smart-generate', requireRoleStr(['admin', 'teacher']), wrap(PaperController.smartGenerate))
router.post('/:id/questions/custom', requireRoleStr(['admin', 'teacher']), wrap(PaperController.addCustomQuestion)) // ✅ 手工题快照

router.post('/create-with-questions', requireRoleStr(['admin', 'teacher']), wrap(PaperController.createWithQuestions))

router.post('/:id/review', requireRoleStr(['admin', 'teacher']), wrap(PaperController.submitReview))
router.post('/:id/questions', requireRoleStr(['admin', 'teacher']), wrap(PaperController.addQuestion))
router.delete('/:id/questions/:questionId', requireRoleStr(['admin', 'teacher']), wrap(PaperController.removeQuestion))
router.get('/:id/questions', wrap(PaperController.getQuestions))
router.put('/:id/questions/order', requireRoleStr(['admin', 'teacher']), wrap(PaperController.updateQuestionOrder))

export { router as paperRoutes }
export default router
