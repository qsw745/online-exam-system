import { Router, type RequestHandler } from 'express'
import type { AuthRequest } from '@/types/auth'
import { authenticateToken } from '@/common/middleware/auth'
import { fileUpload } from '@/common/middleware/upload-file'
import { FileController } from '../controllers/file.controller'

const router = Router()
const wrap =
  (handler: (req: AuthRequest, res: any) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

router.use(authenticateToken)

router.get('/', wrap(FileController.list))
router.get('/uploads', wrap(FileController.listUploads))
router.post('/folders', wrap(FileController.createFolder))
router.post('/upload', fileUpload.single('file'), wrap(FileController.uploadFile))
router.patch('/:id(\\d+)', wrap(FileController.update))
router.delete('/:id(\\d+)', wrap(FileController.remove))

export { router as fileRoutes }
export default router
