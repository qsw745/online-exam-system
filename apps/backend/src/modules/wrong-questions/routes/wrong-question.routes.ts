// apps/backend/src/modules/wrong-questions/routes/wrong-question.routes.ts
import { Router, type RequestHandler } from 'express'
import { authenticateToken } from '@common/middleware/auth'
import { WrongQuestionController } from '../controllers/wrong-question.controller.js'

type AsyncCtrl = (req: any, res: any) => any | Promise<any>
const wrap: (fn: AsyncCtrl) => RequestHandler = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)

const router = Router()
router.use(authenticateToken)

router.post('/books', wrap(WrongQuestionController.createBook))
router.get('/books', wrap(WrongQuestionController.getBooks))
router.put('/books/:id', wrap(WrongQuestionController.updateBook))
router.delete('/books/:id', wrap(WrongQuestionController.deleteBook))

router.post('/questions', wrap(WrongQuestionController.addWrongQuestion))
router.get('/books/:bookId/questions', wrap(WrongQuestionController.getWrongQuestions))
router.put('/questions/:id', wrap(WrongQuestionController.updateWrongQuestion))
router.delete('/questions/:id', wrap(WrongQuestionController.removeWrongQuestion))

router.post('/practiced', wrap(WrongQuestionController.addPracticeRecord))

router.post('/books/:id/share', wrap(WrongQuestionController.shareBook))
router.get('/shared/:shareCode', wrap(WrongQuestionController.getSharedBook))

router.get('/statistics', wrap(WrongQuestionController.getStatistics))

router.post('/questions/batch', wrap(WrongQuestionController.batchAddWrongQuestions))
router.put('/questions/batch/mastery', wrap(WrongQuestionController.batchUpdateMastery))
router.post('/auto-collect', wrap(WrongQuestionController.autoCollectWrongQuestions))

export default router
export { router as wrongQuestionRoutes }
