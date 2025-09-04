// src/routes/index.ts
import { Router } from 'express'
const router = Router()

// 一个小工具：把模块命名空间转成真正的 Router（兼容 default 导出或命名导出）
const pick = (mod: any, ...keys: string[]) => (keys.map(k => mod?.[k]).find(Boolean) ?? mod?.default) as any

/** ---------------- analytics ---------------- */
import * as Analytics from '@modules/analytics/analytics.routes.js'
import * as Dashboard from '@modules/analytics/dashboard.routes.js'
import * as Logs from '@modules/analytics/log.routes.js'

router.use('/analytics', pick(Analytics, 'analyticsRoutes'))
router.use('/dashboard', pick(Dashboard, 'dashboardRoutes'))
router.use('/logs', pick(Logs, 'logRoutes'))

/** ---------------- auth ---------------- */
import * as Auth from '@modules/auth/auth.routes.js'
import * as PwdReset from '@modules/auth/password-reset.routes.js'

router.use('/auth', pick(Auth, 'authRoutes'))
router.use('/password-reset', pick(PwdReset, 'passwordResetRoutes'))

/** ---------------- exams ---------------- */
import * as Exams from '@modules/exams/exam.routes.js'
import * as Papers from '@modules/exams/paper.routes.js'
import * as Results from '@modules/exams/result.routes.js'
import * as ExamResults from '@modules/exams/exam_result.routes.js' // 若不存在可移除

router.use('/exams', pick(Exams, 'examRoutes'))
router.use('/papers', pick(Papers, 'paperRoutes'))
router.use('/results', pick(Results, 'resultRoutes'))
router.use('/exam_results', pick(ExamResults, 'examResultRoutes'))

/** ---------------- favorites（二选一，保留已实现的那套） ---------------- */
import * as Favorite from '@modules/favorites/favorite.routes.js'
// import * as Favorites from '@modules/favorites/favorites.routes.js' // 若你使用这一份，注释上一行并启用本行
router.use('/favorites', pick(Favorite, 'favoriteRoutes'))
// router.use('/favorites', pick(Favorites, 'favoritesRoutes'))

/** ---------------- leaderboard / learning-progress ---------------- */
import * as Leaderboard from '@modules/leaderboard/leaderboard.routes.js'
import * as LearningProgress from '@modules/learning-progress/learning-progress.routes.js'

router.use('/leaderboard', pick(Leaderboard, 'leaderboardRoutes'))
router.use('/learning-progress', pick(LearningProgress, 'learningProgressRoutes'))

/** ---------------- notifications ---------------- */
import * as Notifications from '@modules/notifications/notification.routes.js'
import * as Discussions from '@modules/notifications/discussions.routes.js'

router.use('/notifications', pick(Notifications, 'notificationRoutes'))
router.use('/discussions', pick(Discussions, 'discussionsRoutes'))

/** ---------------- orgs ---------------- */
import * as Orgs from '@modules/orgs/org.routes.js'
import * as OrgUsers from '@modules/orgs/org-user.routes.js'

router.use('/orgs', pick(Orgs, 'orgRoutes'))
router.use('/org-users', pick(OrgUsers, 'orgUserRoutes'))

/** ---------------- questions ---------------- */
import * as Questions from '@modules/questions/question.routes.js'
router.use('/questions', pick(Questions, 'questionRoutes'))

/** ---------------- roles / menus ---------------- */
import * as Roles from '@modules/roles/role.routes.js'
import * as Menus from '@modules/roles/menu.routes.js'

router.use('/roles', pick(Roles, 'roleRoutes'))
router.use('/menus', pick(Menus, 'menuRoutes'))

/** ---------------- tasks / users / wrong-questions ---------------- */
import * as Tasks from '@modules/tasks/task.routes.js'
import * as Users from '@modules/users/user.routes.js'
import * as WrongQuestions from '@modules/wrong-questions/wrong-question.routes.js'

router.use('/tasks', pick(Tasks, 'taskRoutes'))
router.use('/users', pick(Users, 'userRoutes'))
router.use('/wrong-questions', pick(WrongQuestions, 'wrongQuestionRoutes'))

export default router
