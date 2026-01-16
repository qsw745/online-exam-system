import { Router } from 'express'
import { authenticateToken, requireRole } from '@/common/middleware/auth'
import { named } from '@/common/async-handler'
import { SystemTestsController } from '../controllers/system-tests.controller'
import { rateLimit } from '@/common/middleware/rate-limit'

const router = Router()
router.use(authenticateToken)
router.use(requireRole(['admin']))

const limit = rateLimit({ keyBuilder: r => `rl:ip:${(r as any).ip || r.ip}:system-tests`, limit: 10, windowSec: 60 })

router.post('/run', limit, named('system-tests.run', SystemTestsController.run as any))
router.get('/jobs/:id', limit, named('system-tests.job', SystemTestsController.getJob as any))

export { router as systemTestsRoutes }
export default router
