import { Router } from 'express';
import { DiscussionsController } from '../controllers/discussions.controller.js';
import { authenticateToken } from '../middleware/auth.js';
import { body, param, query } from 'express-validator';
import { validateRequest } from '../middleware/validation.js';

const router = Router();

// 获取讨论列表
router.get('/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间'),
    query('category_id').optional().isInt({ min: 1 }).withMessage('分类ID必须是正整数'),
    query('sort').optional().isIn(['latest', 'hot', 'replies', 'likes']).withMessage('排序方式无效'),
    query('search').optional().isLength({ min: 1, max: 100 }).withMessage('搜索关键词长度必须在1-100之间'),
    query('related_type').optional().isIn(['question', 'exam', 'task', 'general']).withMessage('关联类型无效'),
    query('related_id').optional().isInt({ min: 1 }).withMessage('关联ID必须是正整数'),
    query('is_featured').optional().isBoolean().withMessage('精选标识必须是布尔值'),
    validateRequest
  ],
  DiscussionsController.getDiscussions
);

// 获取讨论详情
router.get('/:id',
  [
    param('id').isInt({ min: 1 }).withMessage('讨论ID必须是正整数'),
    query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间'),
    validateRequest
  ],
  DiscussionsController.getDiscussionDetail
);

// 创建讨论（需要认证）
router.post('/',
  authenticateToken,
  [
    body('title').isLength({ min: 1, max: 200 }).withMessage('标题长度必须在1-200字符之间'),
    body('content').isLength({ min: 1, max: 10000 }).withMessage('内容长度必须在1-10000字符之间'),
    body('category_id').optional().isInt({ min: 1 }).withMessage('分类ID必须是正整数'),
    body('tags').optional().isArray().withMessage('标签必须是数组'),
    body('tags.*').optional().isLength({ min: 1, max: 20 }).withMessage('标签长度必须在1-20字符之间'),
    body('related_type').optional().isIn(['question', 'exam', 'task', 'general']).withMessage('关联类型无效'),
    body('related_id').optional().isInt({ min: 1 }).withMessage('关联ID必须是正整数'),
    validateRequest
  ],
  DiscussionsController.createDiscussion
);

// 更新讨论（需要认证）
router.put('/:id',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('讨论ID必须是正整数'),
    body('title').isLength({ min: 1, max: 200 }).withMessage('标题长度必须在1-200字符之间'),
    body('content').isLength({ min: 1, max: 10000 }).withMessage('内容长度必须在1-10000字符之间'),
    body('category_id').optional().isInt({ min: 1 }).withMessage('分类ID必须是正整数'),
    body('tags').optional().isArray().withMessage('标签必须是数组'),
    body('tags.*').optional().isLength({ min: 1, max: 20 }).withMessage('标签长度必须在1-20字符之间'),
    validateRequest
  ],
  DiscussionsController.updateDiscussion
);

// 删除讨论（需要认证）
router.delete('/:id',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('讨论ID必须是正整数'),
    validateRequest
  ],
  DiscussionsController.deleteDiscussion
);

// 创建回复（需要认证）
router.post('/:id/replies',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('讨论ID必须是正整数'),
    body('content').isLength({ min: 1, max: 5000 }).withMessage('回复内容长度必须在1-5000字符之间'),
    body('parent_id').optional().isInt({ min: 1 }).withMessage('父回复ID必须是正整数'),
    validateRequest
  ],
  DiscussionsController.createReply
);

// 点赞/取消点赞（需要认证）
router.post('/like',
  authenticateToken,
  [
    body('target_type').isIn(['discussion', 'reply']).withMessage('目标类型必须是discussion或reply'),
    body('target_id').isInt({ min: 1 }).withMessage('目标ID必须是正整数'),
    validateRequest
  ],
  DiscussionsController.toggleLike
);

// 收藏/取消收藏讨论（需要认证）
router.post('/:id/bookmark',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('讨论ID必须是正整数'),
    validateRequest
  ],
  DiscussionsController.toggleBookmark
);

// 获取讨论分类
router.get('/categories/list',
  DiscussionsController.getCategories
);

// 获取热门标签
router.get('/tags/popular',
  [
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('限制数量必须在1-50之间'),
    validateRequest
  ],
  DiscussionsController.getPopularTags
);

// 获取用户讨论统计（需要认证）
router.get('/stats/user',
  authenticateToken,
  DiscussionsController.getUserStats
);

export default router;