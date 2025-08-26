import { Router } from 'express';
import { PaperController } from '../controllers/paper.controller.js';
import { auth as authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

// 试卷基本操作
router.get('/', PaperController.list);
router.get('/:id', PaperController.getById);
router.post('/', PaperController.create);
router.put('/:id', PaperController.update);
router.delete('/:id', PaperController.delete);

// 智能组卷
router.post('/smart-generate', PaperController.smartGenerate);
router.post('/create-with-questions', PaperController.createWithQuestions);

// 试卷题目管理
router.post('/:id/questions', PaperController.addQuestion);
router.delete('/:id/questions/:questionId', PaperController.removeQuestion);
router.get('/:id/questions', PaperController.getQuestions);
router.put('/:id/questions/order', PaperController.updateQuestionOrder);

export { router as paperRoutes };