// apps/backend/src/modules/favorites/favorites.routes.ts
import { Router, type RequestHandler, type Response } from 'express'
import { FavoritesController } from './favorites.controller.js'
import { authenticateToken } from '../../common/middleware/auth.js'
import type { AuthRequest } from '../../types/auth.js'

const router = Router()

const wrap =
  (handler: (req: AuthRequest, res: Response) => any, handlerName: string): RequestHandler =>
  (req, res, next) => {
    ;(req as any).__handlerName = handlerName
    Promise.resolve(handler(req as AuthRequest, res as any)).catch(next)
  }

router.use(authenticateToken)

// 列表/详情
router.get('/', wrap(FavoritesController.getFavorites, 'FavoritesController.getFavorites'))
router.get('/:id(\\d+)', wrap(FavoritesController.getFavoriteById, 'FavoritesController.getFavoriteById'))

// CRUD
router.post('/', wrap(FavoritesController.createFavorite, 'FavoritesController.createFavorite'))
router.put('/:id(\\d+)', wrap(FavoritesController.updateFavorite, 'FavoritesController.updateFavorite'))
router.delete('/:id(\\d+)', wrap(FavoritesController.deleteFavorite, 'FavoritesController.deleteFavorite'))

// items
router.post('/:id(\\d+)/items', wrap(FavoritesController.addFavoriteItem, 'FavoritesController.addFavoriteItem'))
router.delete(
  '/:id(\\d+)/items/:itemId(\\d+)',
  wrap(FavoritesController.removeFavoriteItem, 'FavoritesController.removeFavoriteItem')
)

// share
router.post('/:id(\\d+)/share', wrap(FavoritesController.generateShareLink, 'FavoritesController.generateShareLink'))
router.get('/shared/:shareCode', wrap(FavoritesController.getSharedFavorite, 'FavoritesController.getSharedFavorite'))

// others
router.get('/categories/list', wrap(FavoritesController.getCategories, 'FavoritesController.getCategories'))
router.get(
  '/status/:itemType/:itemId(\\d+)',
  wrap(FavoritesController.checkFavoriteStatus, 'FavoritesController.checkFavoriteStatus')
)
router.post('/quick', wrap(FavoritesController.quickFavorite, 'FavoritesController.quickFavorite'))
router.post('/unfavorite', wrap(FavoritesController.unfavoriteItem, 'FavoritesController.unfavoriteItem'))
router.get('/search', wrap(FavoritesController.searchFavoriteItems, 'FavoritesController.searchFavoriteItems'))
router.post('/:id(\\d+)/move', wrap(FavoritesController.moveItemsToFavorite, 'FavoritesController.moveItemsToFavorite'))
router.post('/:id(\\d+)/order', wrap(FavoritesController.updateItemsOrder, 'FavoritesController.updateItemsOrder'))
router.get('/stats/me', wrap(FavoritesController.getUserFavoriteStats, 'FavoritesController.getUserFavoriteStats'))
router.get(
  '/public/popular',
  wrap(FavoritesController.getPopularPublicFavorites, 'FavoritesController.getPopularPublicFavorites')
)

export { router as favoriteRoutes }
