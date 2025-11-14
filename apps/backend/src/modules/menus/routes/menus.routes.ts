import { Router } from 'express'
import { MenuController } from '../controllers/menu.controller.js'
import { authenticateToken } from '@/common/middleware/auth.js'

const router = Router()

// 功能菜单树（系统）
router.get('/functions/tree', MenuController.getFunctionsTree)
router.get('/users/:userId(\\d+)/menus', authenticateToken, MenuController.getUserDefaultMenuTree)

// 系统菜单：列表/树/单条
router.get('/', MenuController.getAllMenus)
router.get('/tree', MenuController.getMenuTree)
router.get('/:id(\\d+)', MenuController.getMenuById)

// 系统菜单：增删改/批量排序
router.post('/', authenticateToken, MenuController.createMenu)
router.put('/:id', authenticateToken, MenuController.updateMenu)
router.delete('/:id', authenticateToken, MenuController.deleteMenu)
router.post('/batch-sort', authenticateToken, MenuController.batchUpdateMenuSort)

export { router as menusRoutes }
export default router
