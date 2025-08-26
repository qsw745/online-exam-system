import { Router } from 'express';
import { auth } from '../middleware/auth.middleware.js';
import { TaskController } from '../controllers/task.controller.js';

const router = Router();

// 获取任务列表
router.get('/', auth, TaskController.list);

// 获取任务详情
router.get('/:id', auth, TaskController.get);

// 创建任务
router.post('/', auth, TaskController.create);

// 更新任务
router.put('/:id', auth, TaskController.update);

// 删除任务
router.delete('/:id', auth, TaskController.delete);

// 提交任务答案
router.post('/:id/submit', auth, TaskController.submit);

// 发布任务
router.post('/:id/publish', auth, TaskController.publish);

// 下线任务
router.post('/:id/unpublish', auth, TaskController.unpublish);

// 批量发布任务
router.post('/batch/publish', auth, TaskController.batchPublish);

// 批量下线任务
router.post('/batch/unpublish', auth, TaskController.batchUnpublish);

export { router as taskRoutes };