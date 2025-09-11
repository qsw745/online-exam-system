// apps/backend/src/modules/orgs/routes/org.routes.ts
import { Router, type RequestHandler, type Response } from 'express'
import { OrgController } from '../controllers/org.controller'
import { authenticateToken } from '@/common/middleware/auth'
import { requireRoleByIds } from '@/common/middleware/role-auth'
import { ROLE_IDS } from '@/config/roles'
import type { AuthRequest } from '@/types/auth'

const router = Router()
const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

router.use(authenticateToken)

router.get(
  '/tree',
  requireRoleByIds([ROLE_IDS.SUPER_ADMIN, ROLE_IDS.ADMIN, ROLE_IDS.TEACHER]),
  wrap(OrgController.getTree)
)

router.get('/', requireRoleByIds([ROLE_IDS.ADMIN, ROLE_IDS.TEACHER, ROLE_IDS.SUPER_ADMIN]), wrap(OrgController.list))

router.get(
  '/:id',
  requireRoleByIds([ROLE_IDS.ADMIN, ROLE_IDS.TEACHER, ROLE_IDS.SUPER_ADMIN]),
  wrap(OrgController.getById)
)

router.post('/', requireRoleByIds([ROLE_IDS.ADMIN, ROLE_IDS.SUPER_ADMIN]), wrap(OrgController.create))

router.put('/:id', requireRoleByIds([ROLE_IDS.ADMIN, ROLE_IDS.SUPER_ADMIN]), wrap(OrgController.update))

router.delete('/:id', requireRoleByIds([ROLE_IDS.ADMIN, ROLE_IDS.SUPER_ADMIN]), wrap(OrgController.delete))

router.put('/sort/batch', requireRoleByIds([ROLE_IDS.ADMIN, ROLE_IDS.SUPER_ADMIN]), wrap(OrgController.batchSort))

router.put('/:id/move', requireRoleByIds([ROLE_IDS.ADMIN, ROLE_IDS.SUPER_ADMIN]), wrap(OrgController.move))

export { router as orgRoutes }
export default router
