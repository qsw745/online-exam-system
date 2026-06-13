import { Router, type RequestHandler, type NextFunction, type Response } from 'express'
import { AnnouncementController } from '../controllers/announcement.controller'
import { authenticateToken } from '@/common/middleware/auth'
import { requireRole } from '@/common/middleware/role-auth'

const router = Router()
const wrap =
  (handler: (req: any, res: Response) => unknown | Promise<unknown>): RequestHandler =>
  (req, res, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next)
  }

router.get('/', wrap(AnnouncementController.listPublic))

router.use(authenticateToken)
router.get('/admin', requireRole(['admin', 'teacher']), wrap(AnnouncementController.listAdmin))
router.post('/admin', requireRole(['admin', 'teacher']), wrap(AnnouncementController.create))
router.put('/admin/:id', requireRole(['admin', 'teacher']), wrap(AnnouncementController.update))
router.post('/admin/:id/publish', requireRole(['admin', 'teacher']), wrap(AnnouncementController.publish))
router.delete('/admin/:id', requireRole(['admin', 'teacher']), wrap(AnnouncementController.remove))

export { router as announcementRoutes }
export default router
