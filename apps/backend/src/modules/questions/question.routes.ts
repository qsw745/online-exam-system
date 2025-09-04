// apps/backend/src/modules/questions/question.routes.ts
import { Router, type RequestHandler } from 'express'

// 控制器（同目录）
import { QuestionController } from './question.controller.js'

// 认证中间件（src/common/middleware/auth.ts）
import { authenticateToken } from '../../common/middleware/auth.js'

const router = Router()

/**
 * 最兼容的包装器：用 any 消除控制器签名差异（AuthRequest / Request 等），
 * 只负责捕获异步错误，不改变控制器的类型与返回值。
 */
type AnyAsyncController = (req: any, res: any) => any | Promise<any>
const wrap = (fn: AnyAsyncController): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next)
  }
}

// 统一鉴权
router.use(authenticateToken)

/** ===== 错题本 / 练习相关 ===== */
router.post('/practice', wrap(QuestionController.recordPractice))
router.get('/practiced-questions', wrap(QuestionController.getPracticedQuestions))
router.get('/wrong-questions', wrap(QuestionController.getWrongQuestions))
router.put('/wrong-questions/:questionId/mastered', wrap(QuestionController.markAsMastered))
router.delete('/wrong-questions/:questionId', wrap(QuestionController.removeFromWrongQuestions))
router.get('/practice-stats', wrap(QuestionController.getPracticeStats))

/** ===== 批量导入 & 知识点 ===== */
router.post('/bulk-import', wrap(QuestionController.bulkImport))
router.get('/knowledge-points', wrap(QuestionController.getKnowledgePoints))

/** ===== CRUD ===== */
router.get('/', wrap(QuestionController.list))
router.get('/:id(\\d+)', wrap(QuestionController.getById))
router.post('/', wrap(QuestionController.create))
router.put('/:id(\\d+)', wrap(QuestionController.update))
router.delete('/:id(\\d+)', wrap(QuestionController.delete))

export { router as questionRoutes }
