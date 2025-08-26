import { Router } from 'express';
import { auth } from '../middleware/auth.middleware.js';
import { QuestionController } from '../controllers/question.controller.js';

const router = Router();

// 错题本相关路由 - 必须在通用路由之前定义
router.post('/practice', auth, QuestionController.recordPractice);
router.get('/practiced-questions', auth, QuestionController.getPracticedQuestions);
router.get('/wrong-questions', auth, QuestionController.getWrongQuestions);
router.put('/wrong-questions/:questionId/mastered', auth, QuestionController.markAsMastered);
router.delete('/wrong-questions/:questionId', auth, QuestionController.removeFromWrongQuestions);
router.get('/practice-stats', auth, QuestionController.getPracticeStats);

// 批量导入问题
router.post('/bulk-import', auth, QuestionController.bulkImport);

// 获取知识点列表
router.get('/knowledge-points', auth, QuestionController.getKnowledgePoints);

// 获取问题列表
router.get('/', auth, QuestionController.list);

// 获取问题详情
router.get('/:id', auth, QuestionController.getById);

// 创建问题
router.post('/', auth, QuestionController.create);

// 更新问题
router.put('/:id', auth, QuestionController.update);

// 删除问题
router.delete('/:id', auth, QuestionController.delete);

export { router as questionRoutes };