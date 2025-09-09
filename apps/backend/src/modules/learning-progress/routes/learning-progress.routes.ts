// apps/backend/src/modules/learning-progress/routes/learning-progress.routes.ts
import { Router, type RequestHandler, type Response } from 'express'
import { body, param, query } from 'express-validator'
import { learningProgressController } from '../controllers/learning-progress.controller'
import { validateRequest } from '@common/middleware/validation'
import { authenticateToken } from '@common/middleware/auth'
import type { AuthRequest } from 'types/auth'

const router = Router()

const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)

router.use(authenticateToken)

/** 记录学习进度 */
router.post(
  '/record',
  [
    body('subjectId').optional().isInt({ min: 1 }),
    body('studyTime').isInt({ min: 1 }),
    body('questionsAnswered').isInt({ min: 0 }),
    body('correctAnswers').isInt({ min: 0 }),
    body('studyContent').optional().isString(),
  ],
  validateRequest,
  wrap(learningProgressController.recordProgress.bind(learningProgressController))
)

/** 统计 */
router.get(
  '/stats',
  [query('period').optional().isIn(['7d', '30d', '90d']), query('subjectId').optional().isInt({ min: 1 })],
  validateRequest,
  wrap(learningProgressController.getProgressStats.bind(learningProgressController))
)

/** 学习轨迹 */
router.get(
  '/track',
  [query('startDate').isISO8601(), query('endDate').isISO8601(), query('subjectId').optional().isInt({ min: 1 })],
  validateRequest,
  wrap(learningProgressController.getLearningTrack.bind(learningProgressController))
)

/** 目标 */
router.post(
  '/goals',
  [
    body('goalType').isIn([
      'daily_time',
      'daily_questions',
      'weekly_time',
      'weekly_questions',
      'monthly_time',
      'monthly_questions',
      'accuracy_rate',
      'study_streak',
    ]),
    body('targetValue').isInt({ min: 1 }),
    body('startDate').isISO8601(),
    body('endDate').isISO8601(),
    body('subjectId').optional().isInt({ min: 1 }),
    body('description').optional().isString(),
  ],
  validateRequest,
  wrap(learningProgressController.setLearningGoal.bind(learningProgressController))
)

router.get(
  '/goals',
  [
    query('status').optional().isIn(['active', 'completed', 'paused', 'cancelled']),
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
      ]),
  ],
  validateRequest,
  wrap(learningProgressController.getLearningGoals.bind(learningProgressController))
)

router.put(
  '/goals/:goalId',
  [
    param('goalId').isInt({ min: 1 }),
    body('currentValue').isInt({ min: 0 }),
    body('status').optional().isIn(['active', 'completed', 'paused', 'cancelled']),
  ],
  validateRequest,
  wrap(learningProgressController.updateGoalProgress.bind(learningProgressController))
)

/** 成就 */
router.get('/achievements', wrap(learningProgressController.getLearningAchievements.bind(learningProgressController)))
router.post(
  '/achievements/unlock',
  [body('achievementType').isString(), body('achievementData').optional().isObject()],
  validateRequest,
  wrap(learningProgressController.unlockAchievement.bind(learningProgressController))
)

/** 报告 */
router.get(
  '/report',
  [
    query('period').optional().isIn(['week', 'month', 'quarter', 'year']),
    query('subjectId').optional().isInt({ min: 1 }),
  ],
  validateRequest,
  wrap(learningProgressController.getLearningReport.bind(learningProgressController))
)

/** 学习记录 & 科目 */
router.get(
  '/records',
  [
    query('start_date').optional().isISO8601(),
    query('end_date').optional().isISO8601(),
    query('subject').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validateRequest,
  wrap(learningProgressController.getProgressRecords.bind(learningProgressController))
)

router.get('/subjects', wrap(learningProgressController.getSubjects.bind(learningProgressController)))

export { router as learningProgressRoutes }
export default router
