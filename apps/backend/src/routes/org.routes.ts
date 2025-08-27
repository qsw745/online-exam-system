import { Router } from 'express'
import { OrgController } from '../controllers/org.controller.js'
import { auth, requireRole } from '../middleware/auth.middleware.js'

const router = Router()

// 获取组织树（所有已启用组织，以树形返回）
router.get('/tree', auth, requireRole(['admin', 'teacher']), OrgController.getTree)

// 获取组织列表（分页 / 平铺）
router.get('/', auth, requireRole(['admin', 'teacher']), OrgController.list)

// 获取组织详情
router.get('/:id', auth, requireRole(['admin', 'teacher']), OrgController.getById)

// 创建组织
router.post('/', auth, requireRole(['admin']), OrgController.create)

// 更新组织
router.put('/:id', auth, requireRole(['admin']), OrgController.update)

// 删除组织
router.delete('/:id', auth, requireRole(['admin']), OrgController.delete)

// （可选）批量排序
router.put('/sort/batch', auth, requireRole(['admin']), OrgController.batchSort)

// （可选）移动组织到新父节点
router.put('/:id/move', auth, requireRole(['admin']), OrgController.move)

export { router as orgRoutes }
