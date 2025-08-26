import { Router } from 'express';
import { auth } from '../middleware/auth.middleware.js';
import { FavoriteController } from '../controllers/favorite.controller.js';

const router = Router();

// 获取收藏列表
router.get('/', auth, FavoriteController.list);

// 添加收藏
router.post('/', auth, FavoriteController.add);

// 删除收藏
router.delete('/:questionId', auth, FavoriteController.remove);

export { router as favoriteRoutes };