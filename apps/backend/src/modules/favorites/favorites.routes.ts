// apps/backend/src/routes/favorites.routes.ts
import { Router, type RequestHandler, type Response } from 'express'
import { body, param, query } from 'express-validator'
import { FavoritesController } from '../controllers/favorites.controller.js'
import { validateRequest } from '../middleware/validation.js'
import { authenticateToken } from '../middleware/auth.middleware.js'
import type { AuthRequest } from '../types/auth.js'

const router = Router()

/** 将 (req: AuthRequest, res: Response) 控制器包装为 Express RequestHandler，并统一捕获异步错误 */
const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

// 获取收藏夹列表
router.get(
  '/',
  authenticateToken,
  [
    query('category_id').optional().isInt({ min: 1 }).withMessage('分类ID必须是正整数'),
    query('is_public').optional().isBoolean().withMessage('公开状态必须是布尔值'),
    query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间'),
  ],
  validateRequest,
  wrap(FavoritesController.getFavorites)
)

// 获取收藏夹详情
router.get(
  '/:id',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('收藏夹ID必须是正整数'),
    query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间'),
  ],
  validateRequest,
  wrap(FavoritesController.getFavoriteById)
)

// 创建收藏夹
router.post(
  '/',
  authenticateToken,
  [
    body('name').notEmpty().isLength({ min: 1, max: 100 }).withMessage('收藏夹名称长度必须在1-100字符之间'),
    body('description').optional().isLength({ max: 500 }).withMessage('描述长度不能超过500字符'),
    body('category_id').optional().isInt({ min: 1 }).withMessage('分类ID必须是正整数'),
    body('is_public').optional().isBoolean().withMessage('公开状态必须是布尔值'),
  ],
  validateRequest,
  wrap(FavoritesController.createFavorite)
)

// 更新收藏夹
router.put(
  '/:id',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('收藏夹ID必须是正整数'),
    body('name').optional().isLength({ min: 1, max: 100 }).withMessage('收藏夹名称长度必须在1-100字符之间'),
    body('description').optional().isLength({ max: 500 }).withMessage('描述长度不能超过500字符'),
    body('category_id').optional().isInt({ min: 1 }).withMessage('分类ID必须是正整数'),
    body('is_public').optional().isBoolean().withMessage('公开状态必须是布尔值'),
  ],
  validateRequest,
  wrap(FavoritesController.updateFavorite)
)

// 删除收藏夹
router.delete(
  '/:id',
  authenticateToken,
  [param('id').isInt({ min: 1 }).withMessage('收藏夹ID必须是正整数')],
  validateRequest,
  wrap(FavoritesController.deleteFavorite)
)

// 添加收藏项目
router.post(
  '/:id/items',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('收藏夹ID必须是正整数'),
    body('item_type')
      .isIn(['question', 'exam', 'task', 'note'])
      .withMessage('项目类型必须是question、exam、task或note'),
    body('item_id').isInt({ min: 1 }).withMessage('项目ID必须是正整数'),
    body('title').optional().isLength({ max: 200 }).withMessage('标题长度不能超过200字符'),
    body('description').optional().isLength({ max: 500 }).withMessage('描述长度不能超过500字符'),
    body('tags').optional().isArray().withMessage('标签必须是数组'),
    body('notes').optional().isLength({ max: 1000 }).withMessage('笔记长度不能超过1000字符'),
  ],
  validateRequest,
  wrap(FavoritesController.addFavoriteItem)
)

// 删除收藏项目
router.delete(
  '/:id/items/:itemId',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('收藏夹ID必须是正整数'),
    param('itemId').isInt({ min: 1 }).withMessage('项目ID必须是正整数'),
  ],
  validateRequest,
  wrap(FavoritesController.removeFavoriteItem)
)

// 快速收藏
router.post(
  '/quick-favorite',
  authenticateToken,
  [
    body('item_type')
      .isIn(['question', 'exam', 'task', 'note'])
      .withMessage('项目类型必须是question、exam、task或note'),
    body('item_id').isInt({ min: 1 }).withMessage('项目ID必须是正整数'),
    body('title').optional().isLength({ max: 200 }).withMessage('标题长度不能超过200字符'),
    body('description').optional().isLength({ max: 500 }).withMessage('描述长度不能超过500字符'),
  ],
  validateRequest,
  wrap(FavoritesController.quickFavorite)
)

// 取消收藏
router.delete(
  '/unfavorite',
  authenticateToken,
  [
    body('item_type')
      .isIn(['question', 'exam', 'task', 'note'])
      .withMessage('项目类型必须是question、exam、task或note'),
    body('item_id').isInt({ min: 1 }).withMessage('项目ID必须是正整数'),
  ],
  validateRequest,
  wrap(FavoritesController.unfavoriteItem)
)

// 检查收藏状态
router.get(
  '/check/:itemType/:itemId',
  authenticateToken,
  [
    param('itemType')
      .isIn(['question', 'exam', 'task', 'note'])
      .withMessage('项目类型必须是question、exam、task或note'),
    param('itemId').isInt({ min: 1 }).withMessage('项目ID必须是正整数'),
  ],
  validateRequest,
  wrap(FavoritesController.checkFavoriteStatus)
)

// 生成分享链接
router.post(
  '/:id/share',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('收藏夹ID必须是正整数'),
    body('expires_in_days').optional().isInt({ min: 1, max: 365 }).withMessage('过期天数必须在1-365之间'),
    body('access_password').optional().isLength({ min: 4, max: 20 }).withMessage('访问密码长度必须在4-20字符之间'),
  ],
  validateRequest,
  wrap(FavoritesController.generateShareLink)
)

// 通过分享码访问收藏夹（可不认证）
router.get(
  '/shared/:shareCode',
  [
    param('shareCode').isLength({ min: 8, max: 32 }).withMessage('分享码格式不正确'),
    body('password').optional().isLength({ min: 4, max: 20 }).withMessage('密码长度必须在4-20字符之间'),
  ],
  validateRequest,
  wrap(FavoritesController.getSharedFavorite)
)

// 搜索收藏项目
router.get(
  '/search/items',
  authenticateToken,
  [
    query('keyword').notEmpty().isLength({ min: 1, max: 100 }).withMessage('搜索关键词长度必须在1-100字符之间'),
    query('item_type')
      .optional()
      .isIn(['question', 'exam', 'task', 'note'])
      .withMessage('项目类型必须是question、exam、task或note'),
    query('favorite_id').optional().isInt({ min: 1 }).withMessage('收藏夹ID必须是正整数'),
  ],
  validateRequest,
  wrap(FavoritesController.searchFavoriteItems)
)

// 批量移动收藏项目
router.post(
  '/move-items',
  authenticateToken,
  [
    body('item_ids').isArray({ min: 1 }).withMessage('项目ID列表不能为空'),
    body('item_ids.*').isInt({ min: 1 }).withMessage('项目ID必须是正整数'),
    body('target_favorite_id').isInt({ min: 1 }).withMessage('目标收藏夹ID必须是正整数'),
  ],
  validateRequest,
  wrap(FavoritesController.moveItemsToFavorite)
)

// 复制收藏夹
router.post(
  '/:id/copy',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('收藏夹ID必须是正整数'),
    body('new_name').notEmpty().isLength({ min: 1, max: 100 }).withMessage('新收藏夹名称长度必须在1-100字符之间'),
  ],
  validateRequest,
  wrap(FavoritesController.copyFavorite)
)

// 更新收藏项目排序
router.put(
  '/:id/items/order',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('收藏夹ID必须是正整数'),
    body('item_orders').isArray({ min: 1 }).withMessage('排序列表不能为空'),
    body('item_orders.*.id').isInt({ min: 1 }).withMessage('项目ID必须是正整数'),
    body('item_orders.*.sort_order').isInt({ min: 0 }).withMessage('排序值必须是非负整数'),
  ],
  validateRequest,
  wrap(FavoritesController.updateItemsOrder)
)

// 获取收藏夹分类
router.get('/categories/list', authenticateToken, wrap(FavoritesController.getCategories))

// 获取用户收藏统计
router.get('/stats/user', authenticateToken, wrap(FavoritesController.getUserFavoriteStats))

// 获取热门公开收藏夹（无需认证）
router.get(
  '/public/popular',
  [query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('数量限制必须在1-50之间')],
  validateRequest,
  wrap(FavoritesController.getPopularPublicFavorites)
)

export default router
