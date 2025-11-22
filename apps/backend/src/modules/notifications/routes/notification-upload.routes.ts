import { Router, type RequestHandler, type NextFunction, type Response } from 'express'
import multer from 'multer'
import { authenticateToken } from '@/common/middleware/auth'
import { requireRole } from '@/common/middleware/role-auth'
import { NotificationUploadController } from '../controllers/notification-upload.controller'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })
const wrap =
  (handler: (req: any, res: Response) => unknown | Promise<unknown>): RequestHandler =>
  (req, res, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next)
  }

router.use(authenticateToken, requireRole(['admin', 'teacher']))

router.post('/check', wrap(NotificationUploadController.check))
router.post('/chunk', upload.single('chunk'), wrap(NotificationUploadController.uploadChunk))
router.post('/merge', wrap(NotificationUploadController.merge))

export { router as notificationUploadRoutes }
export default router
