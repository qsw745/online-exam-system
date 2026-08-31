import { Router, type RequestHandler, type Response } from 'express'
import { authenticateToken, requireRole } from '@/common/middleware/auth'
import type { AuthRequest } from '@/types/auth'
import { PrivacyLifecycleController } from '../controllers/privacy-lifecycle.controller'

const router=Router(), admin=requireRole as unknown as (roles:string[])=>RequestHandler
const wrap=(handler:(req:AuthRequest,res:Response)=>unknown):RequestHandler=>(req,res,next)=>Promise.resolve(handler(req as AuthRequest,res)).catch(next)
router.use(authenticateToken,admin(['admin']))
router.get('/requests',wrap(PrivacyLifecycleController.listRequests))
router.get('/requests/:requestId',wrap(PrivacyLifecycleController.getRequest))
router.post('/dry-run',wrap(PrivacyLifecycleController.dryRun))
router.post('/holds',wrap(PrivacyLifecycleController.createHold))
router.post('/holds/:holdId/release',wrap(PrivacyLifecycleController.releaseHold))
router.post('/holds/:holdId/extend',wrap(PrivacyLifecycleController.extendHold))
router.post('/controls/pause',wrap(PrivacyLifecycleController.pause))
router.post('/controls/resume',wrap(PrivacyLifecycleController.resume))
router.post('/steps/:stepId/retry',wrap(PrivacyLifecycleController.retry))
export {router as privacyLifecycleRoutes}
export default router
