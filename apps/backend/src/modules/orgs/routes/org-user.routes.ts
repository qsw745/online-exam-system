// apps/backend/src/modules/orgs/routes/org-user.routes.ts
import { Router, type Request, type Response, type NextFunction, type RequestHandler } from 'express'
import { OrgUserController } from '../controllers/org-user.controller'
import { authenticateToken } from '@/common/middleware/auth'
import { requireRoleByIds } from '@/common/middleware/role-auth'
import { ROLE_IDS } from '@/config/roles'
import type { AuthRequest } from 'types/auth'

const router = Router()
const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

router.use(authenticateToken)

router.get('/', requireRoleByIds([ROLE_IDS.ADMIN, ROLE_IDS.TEACHER]), wrap(OrgUserController.listUsers))
router.post('/:orgId/users', requireRoleByIds([ROLE_IDS.ADMIN]), wrap(OrgUserController.addUsers))
router.delete('/:orgId/users/:userId', requireRoleByIds([ROLE_IDS.ADMIN]), wrap(OrgUserController.removeUser))
router.put('/:userId/primary', requireRoleByIds([ROLE_IDS.ADMIN]), wrap(OrgUserController.setPrimary))
router.put(
  '/:fromOrgId/users/:userId/move/:toOrgId',
  requireRoleByIds([ROLE_IDS.ADMIN]),
  wrap(OrgUserController.moveUser)
)

export { router as orgUserRoutes }
export default router
