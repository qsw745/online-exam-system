import { Router, type RequestHandler, type Response, type NextFunction } from 'express'
import { authenticateToken } from '@/common/middleware/auth'
import { MailController } from '../controllers/mail.controller'

const router = Router()

const wrap =
  (handler: (req: any, res: Response) => unknown | Promise<unknown>): RequestHandler =>
  (req, res, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next)
  }

router.use(authenticateToken)

router.get('/inbox', wrap(MailController.inbox))
router.get('/sent', wrap(MailController.sent))
router.get('/drafts', wrap(MailController.drafts))
router.get('/recipients/options', wrap(MailController.recipientOptions))
router.delete('/inbox/:id', wrap(MailController.deleteInbox))
router.delete('/drafts/:id', wrap(MailController.deleteDraft))
router.delete('/sent/:id', wrap(MailController.deleteSent))
router.put('/sent/:id/recall', wrap(MailController.recallSent))
router.get('/:id', wrap(MailController.detail))
router.post('/draft', wrap(MailController.saveDraft))
router.post('/send', wrap(MailController.send))
router.put('/:id/read', wrap(MailController.markRead))

export { router as mailRoutes }
export default router
