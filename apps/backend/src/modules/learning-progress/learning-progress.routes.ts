// apps/backend/src/routes/learning-progress.routes.ts
import { Router, type RequestHandler, type Response } from 'express'
import { body, param, query } from 'express-validator'
import { learningProgressController } from '../controllers/learning-progress.controller.js'
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

// 应用认证中间件（如需开放某些接口，再单独移除/改用 optionalAuth）
router.use(authenticateToken)

// 记录学习进度
router.post(
  '/record',
  [
    body('subjectId').optional().isInt({ min: 1 }).withMessage('科目ID必须是正整数'),
    body('studyTime').isInt({ min: 1 }).withMessage('学习时长必须是正整数'),
    body('questionsAnswered').isInt({ min: 0 }).withMessage('答题数量必须是非负整数'),
    body('correctAnswers').isInt({ min: 0 }).withMessage('正确答题数量必须是非负整数'),
    body('studyContent').optional().isString().withMessage('学习内容必须是字符串'),
  ],
  validateRequest,
  wrap(learningProgressController.recordProgress.bind(learningProgressController))
)

// 获取学习进度统计
router.get(
  '/stats',
  [
    query('period').optional().isIn(['7d', '30d', '90d']).withMessage('时间周期必须是7d、30d或90d'),
    query('subjectId').optional().isInt({ min: 1 }).withMessage('科目ID必须是正整数'),
  ],
  validateRequest,
  wrap(learningProgressController.getProgressStats.bind(learningProgressController))
)

// 获取学习轨迹
router.get(
  '/track',
  [
    query('startDate').isISO8601().withMessage('开始日期格式不正确'),
    query('endDate').isISO8601().withMessage('结束日期格式不正确'),
    query('subjectId').optional().isInt({ min: 1 }).withMessage('科目ID必须是正整数'),
  ],
  validateRequest,
  wrap(learningProgressController.getLearningTrack.bind(learningProgressController))
)

// 设置学习目标
router.post(
  '/goals',
  [
    body('goalType')
      .isIn([
        'daily_time',
        'daily_questions',
        'weekly_time',
        'weekly_questions',
        'monthly_time',
        'monthly_questions',
        'accuracy_rate',
        'study_streak',
      ])
      .withMessage('目标类型不正确'),
    body('targetValue').isInt({ min: 1 }).withMessage('目标值必须是正整数'),
    body('startDate').isISO8601().withMessage('开始日期格式不正确'),
    body('endDate').isISO8601().withMessage('结束日期格式不正确'),
    body('subjectId').optional().isInt({ min: 1 }).withMessage('科目ID必须是正整数'),
    body('description').optional().isString().withMessage('描述必须是字符串'),
  ],
  validateRequest,
  wrap(learningProgressController.setLearningGoal.bind(learningProgressController))
)

// 获取学习目标
router.get(
  '/goals',
  [
    query('status').optional().isIn(['active', 'completed', 'paused', 'cancelled']).withMessage('状态值不正确'),
    query('goalType')
      .optional()
      .isIn([
        'daily_time',
        'daily_questions',
        'weekly_time',
        'weekly_questions',
        'monthly_time',
        'monthly_questions',
        'accuracy_rate',
        'study_streak',
      ])
      .withMessage('目标类型不正确'),
  ],
  validateRequest,
  wrap(learningProgressController.getLearningGoals.bind(learningProgressController))
)

// 更新学习目标进度
router.put(
  '/goals/:goalId',
  [
    param('goalId').isInt({ min: 1 }).withMessage('目标ID必须是正整数'),
    body('currentValue').isInt({ min: 0 }).withMessage('当前值必须是非负整数'),
    body('status').optional().isIn(['active', 'completed', 'paused', 'cancelled']).withMessage('状态值不正确'),
  ],
  validateRequest,
  wrap(learningProgressController.updateGoalProgress.bind(learningProgressController))
)

// 获取学习成就
router.get('/achievements', wrap(learningProgressController.getLearningAchievements.bind(learningProgressController)))

// 解锁学习成就
router.post(
  '/achievements/unlock',
  [
    body('achievementType').isString().withMessage('成就类型必须是字符串'),
    body('achievementData').optional().isObject().withMessage('成就数据必须是对象'),
  ],
  validateRequest,
  wrap(learningProgressController.unlockAchievement.bind(learningProgressController))
)

// 获取学习报告
router.get(
  '/report',
  [
    query('period')
      .optional()
      .isIn(['week', 'month', 'quarter', 'year'])
      .withMessage('时间周期必须是week、month、quarter或year'),
    query('subjectId').optional().isInt({ min: 1 }).withMessage('科目ID必须是正整数'),
  ],
  validateRequest,
  wrap(learningProgressController.getLearningReport.bind(learningProgressController))
)

// 获取学习记录
router.get(
  '/records',
  [
    query('start_date').optional().isISO8601().withMessage('开始日期格式不正确'),
    query('end_date').optional().isISO8601().withMessage('结束日期格式不正确'),
    query('subject').optional().isString().withMessage('科目名称必须是字符串'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('限制数量必须是1-100之间的整数'),
  ],
  validateRequest,
  wrap(learningProgressController.getProgressRecords.bind(learningProgressController))
)

// 获取科目列表
router.get('/subjects', wrap(learningProgressController.getSubjects.bind(learningProgressController)))

export default router
