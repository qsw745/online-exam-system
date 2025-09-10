// apps/backend/src/modules/exams/routes/paper.routes.ts
import { Router, type RequestHandler, type NextFunction, type Response } from 'express'
import { PaperController } from '../controllers/paper.controller'
import { authenticateToken } from '@/common/middleware/auth'
import type { AuthRequest } from 'types/auth'

const router = Router()

const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next: NextFunction) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

router.use(authenticateToken)

router.get('/', wrap(PaperController.list))
router.get('/:id', wrap(PaperController.getById))
router.post('/', wrap(PaperController.create))
router.put('/:id', wrap(PaperController.update))
router.delete('/:id', wrap(PaperController.delete))

router.post('/smart-generate', wrap(PaperController.smartGenerate))
router.post('/create-with-questions', wrap(PaperController.createWithQuestions))

router.post('/:id/questions', wrap(PaperController.addQuestion))
router.delete('/:id/questions/:questionId', wrap(PaperController.removeQuestion))
router.get('/:id/questions', wrap(PaperController.getQuestions))
router.put('/:id/questions/order', wrap(PaperController.updateQuestionOrder))

export { router as paperRoutes }
export default router
