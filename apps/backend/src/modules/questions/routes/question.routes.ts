import { authenticateToken } from '@/common/middleware/auth'
import { Router, type RequestHandler } from 'express'
import { QuestionController } from '../controllers/question.controller'

const router = Router()
type AnyAsyncController = (req: any, res: any) => any | Promise<any>
const wrap =
    (fn: AnyAsyncController, name?: string): RequestHandler =>
        (req, res, next) => { ;(req as any).__handlerName = name || fn.name || 'anonymous'; Promise.resolve(fn(req, res)).catch(next) }

router.use(authenticateToken)

/** 批量拉取题目详情（性能优化） */
router.post('/batch', wrap(QuestionController.getBatchByIds))

/** 错题本 / 练习相关 */
router.post('/practice', wrap(QuestionController.recordPractice))
router.get('/practiced-questions', wrap(QuestionController.getPracticedQuestions))
router.get('/wrong-questions', wrap(QuestionController.getWrongQuestions))
router.put('/wrong-questions/:questionId/mastered', wrap(QuestionController.markAsMastered))
router.delete('/wrong-questions/:questionId', wrap(QuestionController.removeFromWrongQuestions))
router.get('/practice-stats', wrap(QuestionController.getPracticeStats))

/** 批量导入 & 聚合 */
router.post('/bulk-import', wrap(QuestionController.bulkImport))
router.get('/knowledge-points', wrap(QuestionController.getKnowledgePoints))
router.get('/tags', wrap(QuestionController.getTags))

/** CRUD */
router.get('/', wrap(QuestionController.list))
router.get('/:id(\\d+)', wrap(QuestionController.getById))
router.post('/', wrap(QuestionController.create))
router.put('/:id(\\d+)', wrap(QuestionController.update))
router.delete('/:id(\\d+)', wrap(QuestionController.delete))

export { router as questionRoutes }
export default router
