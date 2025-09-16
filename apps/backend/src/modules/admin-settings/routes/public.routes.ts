import { Router } from 'express'
import { AdminSettingsController } from '../controllers/admin-settings.controller.js'

const router = Router()

// ⚠️ 不要加 authenticateToken/requireRole
router.get('/settings', AdminSettingsController.getPublicSettings)

export { router as publicSettingsRoutes }
export default router
