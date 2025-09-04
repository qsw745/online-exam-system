// apps/backend/src/routes/question.routes.ts
import { Router, type RequestHandler } from 'express'

import { QuestionController } from '../controllers/question.controller.js'
import { authenticateToken } from '../middleware/auth.middleware.js'

const router = Router()

/**
 * 将任意 (req, res) => Promise 的控制器包装成标准的 RequestHandler。
 * 这样就不会跟 express 的重载签名冲突。
 */
type AnyAsyncController = (req: any, res: any) => any | Promise<any>
const wrap = (fn: AnyAsyncController): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next)
  }
}

// 错题本相关路由 - 必须在通用路由之前定义
router.post('/practice', authenticateToken, wrap(QuestionController.recordPractice))
router.get('/practiced-questions', authenticateToken, wrap(QuestionController.getPracticedQuestions))
router.get('/wrong-questions', authenticateToken, wrap(QuestionController.getWrongQuestions))
router.put('/wrong-questions/:questionId/mastered', authenticateToken, wrap(QuestionController.markAsMastered))
router.delete('/wrong-questions/:questionId', authenticateToken, wrap(QuestionController.removeFromWrongQuestions))
router.get('/practice-stats', authenticateToken, wrap(QuestionController.getPracticeStats))

// 批量导入问题
router.post('/bulk-import', authenticateToken, wrap(QuestionController.bulkImport))

// 获取知识点列表
router.get('/knowledge-points', authenticateToken, wrap(QuestionController.getKnowledgePoints))

// CRUD
router.get('/', authenticateToken, wrap(QuestionController.list))
router.get('/:id(\\d+)', authenticateToken, wrap(QuestionController.getById))

router.post('/', authenticateToken, wrap(QuestionController.create))
router.put('/:id(\\d+)', authenticateToken, wrap(QuestionController.update))

router.delete('/:id(\\d+)', authenticateToken, wrap(QuestionController.delete))


export { router as questionRoutes }
