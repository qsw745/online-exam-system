import { Router, type RequestHandler } from 'express'
import { authenticateToken } from '@/common/middleware/auth'
import * as FavoritesControllerMod from '../controllers/favorites.controller.js'

type AsyncCtrl = (req: any, res: any) => any | Promise<any>
const wrap: (fn: AsyncCtrl) => RequestHandler = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)

// 兼容：命名导出 / 默认导出 / 直接对象
const C: any =
  (FavoritesControllerMod as any).FavoritesController ??
  (FavoritesControllerMod as any).default ??
  FavoritesControllerMod

const router = Router()
router.use(authenticateToken)

/**
 * 映射：
 * - list             GET    /
 * - getCategories    GET    /categories/list     ← 新增（顺序在 /:id 前！）
 * - getById          GET    /:id
 * - create           POST   /
 * - update           PUT    /:id
 * - remove           DELETE /:id
 * - getItems         GET    /:id/items
 * - addItem          POST   /:id/items
 * - removeItem       DELETE /:id/items/:itemId
 * - share            POST   /:id/share
 * - searchItems      GET    /search
 */

// 列表
router.get('/', wrap(C.list))

// 分类（一定要放在 /:id 前面）
router.get('/categories/list', wrap(C.getCategories))

// 详情
router.get('/:id(\\d+)', wrap(C.getById))

// CRUD
router.post('/', wrap(C.create))
router.put('/:id(\\d+)', wrap(C.update))
router.delete('/:id(\\d+)', wrap(C.remove))

// items
router.get('/:id(\\d+)/items', wrap(C.getItems))
router.post('/:id(\\d+)/items', wrap(C.addItem))
router.delete('/:id(\\d+)/items/:itemId(\\d+)', wrap(C.removeItem))

// share
router.post('/:id(\\d+)/share', wrap(C.share))

// 搜索
router.get('/search', wrap(C.searchItems))

export default router
export { router as favoritesRoutes }
