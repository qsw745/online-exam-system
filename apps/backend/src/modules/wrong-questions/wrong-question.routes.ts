// apps/backend/src/routes/wrong-question.routes.ts
import { Router, type RequestHandler } from 'express'
import { authenticateToken } from '../../common/middleware/auth.js'
import { WrongQuestionController } from './wrong-question.controller.js'

/** 包装异步控制器，避免 TS2769 重载不匹配并统一错误处理 */
type AnyAsyncController = (req: any, res: any) => any | Promise<any>
const wrap =
  (fn: AnyAsyncController): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res)).catch(next)

const router = Router()

// 应用认证中间件
router.use(authenticateToken)

// 错题本管理路由
router.post('/books', wrap(WrongQuestionController.createBook)) // 创建错题本
router.get('/books', wrap(WrongQuestionController.getBooks)) // 获取用户错题本列表
router.put('/books/:id', wrap(WrongQuestionController.updateBook)) // 更新错题本
router.delete('/books/:id', wrap(WrongQuestionController.deleteBook)) // 删除错题本

// 错题管理路由
router.post('/questions', wrap(WrongQuestionController.addWrongQuestion)) // 添加错题
router.get('/books/:bookId/questions', wrap(WrongQuestionController.getWrongQuestions)) // 获取错题本中的错题列表
router.put('/questions/:id', wrap(WrongQuestionController.updateWrongQuestion)) // 更新错题信息
router.delete('/questions/:id', wrap(WrongQuestionController.removeWrongQuestion)) // 移除错题

// 练习记录路由
router.post('/practice', wrap(WrongQuestionController.addPracticeRecord)) // 添加练习记录

// 错题本分享路由
router.post('/books/:id/share', wrap(WrongQuestionController.shareBook)) // 分享错题本
router.get('/shared/:shareCode', wrap(WrongQuestionController.getSharedBook)) // 获取分享的错题本

// 统计信息路由
router.get('/statistics', wrap(WrongQuestionController.getStatistics)) // 获取错题统计信息

// 批量操作
router.post('/questions/batch', wrap(WrongQuestionController.batchAddWrongQuestions)) // 批量添加错题
router.put('/questions/batch/mastery', wrap(WrongQuestionController.batchUpdateMastery)) // 批量更新掌握程度
router.post('/auto-collect', wrap(WrongQuestionController.autoCollectWrongQuestions)) // 自动收集错题

export default router
