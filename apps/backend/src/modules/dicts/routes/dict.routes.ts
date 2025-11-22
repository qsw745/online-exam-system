import { Router, type RequestHandler } from 'express'
import { authenticateToken } from '@/common/middleware/auth'
import type { AuthRequest } from '@/types/auth'
import { DictController } from '../controllers/dict.controller'

const router = Router()
const wrap =
  (handler: (req: AuthRequest, res: any) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

router.use(authenticateToken)

router.get('/', wrap(DictController.list))
router.post('/', wrap(DictController.create))
router.put('/:id', wrap(DictController.update))
router.delete('/:id', wrap(DictController.remove))

router.get('/:dictId/items', wrap(DictController.listItems))
router.post('/:dictId/items', wrap(DictController.createItem))
router.put('/:dictId/items/:itemId', wrap(DictController.updateItem))
router.delete('/:dictId/items/:itemId', wrap(DictController.removeItem))

export { router as dictRoutes }
export default router
