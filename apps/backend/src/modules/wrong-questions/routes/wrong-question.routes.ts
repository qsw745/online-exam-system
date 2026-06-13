import { Router, type RequestHandler } from 'express'
import { authenticateToken } from '@/common/middleware/auth'
import { WrongQuestionController } from '../controllers/wrong-question.controller.js'

type AsyncCtrl = (req: any, res: any) => any | Promise<any>
const wrap: (fn: AsyncCtrl) => RequestHandler = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)

const router = Router()
router.use(authenticateToken)

// ---- 错题本 CRUD ----
router.post('/books', wrap(WrongQuestionController.createBook))
router.get('/books', wrap(WrongQuestionController.getBooks))
router.put('/books/:id', wrap(WrongQuestionController.updateBook))
router.delete('/books/:id', wrap(WrongQuestionController.deleteBook))

// ---- 错题 CRUD ----
router.post('/questions', wrap(WrongQuestionController.addWrongQuestion))
router.get('/books/:bookId/questions', wrap(WrongQuestionController.getWrongQuestions))
router.put('/questions/:id', wrap(WrongQuestionController.updateWrongQuestion))
router.delete('/questions/:id', wrap(WrongQuestionController.removeWrongQuestion))

// ---- 练习记录 ----
router.post('/practice', wrap(WrongQuestionController.addPracticeRecord))

// ✅ 已练习题：支持 GET 与 POST，兼容你前端的 POST 调用
router.get('/practiced', wrap(WrongQuestionController.getPracticedQuestions))
router.post(
  '/practiced',
  wrap(async (req, res) => {
    // 允许 limit 从 body 传入
    if (req.body && req.body.limit && !req.query.limit) req.query.limit = String(req.body.limit)
    return WrongQuestionController.getPracticedQuestions(req as any, res as any)
  })
)

// ---- 分享/统计/批量 ----
router.post('/books/:id/share', wrap(WrongQuestionController.shareBook))
router.get('/shared/:shareCode', wrap(WrongQuestionController.getSharedBook))
router.get('/statistics', wrap(WrongQuestionController.getStatistics))
router.post('/questions/batch', wrap(WrongQuestionController.batchAddWrongQuestions))
router.put('/questions/batch/mastery', wrap(WrongQuestionController.batchUpdateMastery))
router.post('/auto-collect', wrap(WrongQuestionController.autoCollectWrongQuestions))

export default router
export { router as wrongQuestionRoutes }
