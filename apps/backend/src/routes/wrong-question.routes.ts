import { Router } from 'express';
import { WrongQuestionController } from '../controllers/wrong-question.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = Router();

// 应用认证中间件
router.use(authenticateToken);

// 错题本管理路由
router.post('/books', WrongQuestionController.createBook);                    // 创建错题本
router.get('/books', WrongQuestionController.getBooks);                       // 获取用户错题本列表
router.put('/books/:id', WrongQuestionController.updateBook);                 // 更新错题本
router.delete('/books/:id', WrongQuestionController.deleteBook);              // 删除错题本

// 错题管理路由
router.post('/questions', WrongQuestionController.addWrongQuestion);          // 添加错题
router.get('/books/:bookId/questions', WrongQuestionController.getWrongQuestions); // 获取错题本中的错题列表
router.put('/questions/:id', WrongQuestionController.updateWrongQuestion);    // 更新错题信息
router.delete('/questions/:id', WrongQuestionController.removeWrongQuestion); // 移除错题

// 练习记录路由
router.post('/practice', WrongQuestionController.addPracticeRecord);          // 添加练习记录

// 错题本分享路由
router.post('/books/:id/share', WrongQuestionController.shareBook);           // 分享错题本
router.get('/shared/:shareCode', WrongQuestionController.getSharedBook);      // 获取分享的错题本

// 统计信息路由
router.get('/statistics', WrongQuestionController.getStatistics);             // 获取错题统计信息

// 批量操作
router.post('/questions/batch', WrongQuestionController.batchAddWrongQuestions);        // 批量添加错题
router.put('/questions/batch/mastery', WrongQuestionController.batchUpdateMastery);     // 批量更新掌握程度
router.post('/auto-collect', WrongQuestionController.autoCollectWrongQuestions);         // 自动收集错题

export default router;
