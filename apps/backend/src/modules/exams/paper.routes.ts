// apps/backend/src/routes/paper.routes.ts
import { Router, type RequestHandler, type Response } from 'express'
import { PaperController } from '../controllers/paper.controller.js'
import { authenticateToken } from '../middleware/auth.middleware.js'
import type { AuthRequest } from '../types/auth.js'

const router = Router()

/** 将控制器包装为 Express RequestHandler，并统一捕获异步错误 */
const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

// 所有试卷路由需要认证
router.use(authenticateToken)

// 试卷基本操作
router.get('/', wrap(PaperController.list))
router.get('/:id', wrap(PaperController.getById))
router.post('/', wrap(PaperController.create))
router.put('/:id', wrap(PaperController.update))
router.delete('/:id', wrap(PaperController.delete))

// 智能组卷
router.post('/smart-generate', wrap(PaperController.smartGenerate))
router.post('/create-with-questions', wrap(PaperController.createWithQuestions))

// 试卷题目管理
router.post('/:id/questions', wrap(PaperController.addQuestion))
router.delete('/:id/questions/:questionId', wrap(PaperController.removeQuestion))
router.get('/:id/questions', wrap(PaperController.getQuestions))
router.put('/:id/questions/order', wrap(PaperController.updateQuestionOrder))

export { router as paperRoutes }
