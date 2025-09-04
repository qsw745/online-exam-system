import * as express from 'express'
const router = express.Router()

// 从命名空间里挑出命名导出或 default
const pick = (mod: any, ...keys: string[]) => (keys.map(k => mod?.[k]).find(Boolean) ?? mod?.default) as any

// 仅当拿到有效 Router 时再挂载，避免把 undefined 传给 router.use
const useIf = (mountPath: string, mod: any, ...keys: string[]) => {
  const r = pick(mod, ...keys)
  if (r) router.use(mountPath, r)
}

/** ---------------- analytics ---------------- */
import * as Analytics from '@modules/analytics/analytics.routes.js'
import * as Dashboard from '@modules/analytics/dashboard.routes.js'
import * as Logs from '@modules/analytics/log.routes.js'

useIf('/analytics', Analytics, 'analyticsRoutes')
useIf('/dashboard', Dashboard, 'dashboardRoutes')
useIf('/logs', Logs, 'logRoutes')

/** ---------------- auth ---------------- */
import * as Auth from '@modules/auth/auth.routes.js'
import * as PwdReset from '@modules/auth/password-reset.routes.js'

useIf('/auth', Auth, 'authRoutes')
useIf('/password-reset', PwdReset, 'passwordResetRoutes')

/** ---------------- exams ---------------- */
import * as Exams from '@modules/exams/exam.routes.js'
import * as Papers from '@modules/exams/paper.routes.js'
import * as Results from '@modules/exams/result.routes.js'
import * as ExamResults from '@modules/exams/exam_result.routes.js' // 可能不存在

useIf('/exams', Exams, 'examRoutes')
useIf('/papers', Papers, 'paperRoutes')
useIf('/results', Results, 'resultRoutes')
useIf('/exam_results', ExamResults, 'examResultRoutes')

/** ---------------- favorites（保留一个实现） ---------------- */
import * as Favorite from '@modules/favorites/favorite.routes.js'
// import * as Favorites from '@modules/favorites/favorites.routes.js'
useIf('/favorites', Favorite, 'favoriteRoutes')
// useIf('/favorites', Favorites, 'favoritesRoutes')

/** ---------------- leaderboard / learning-progress ---------------- */
import * as Leaderboard from '@modules/leaderboard/leaderboard.routes.js'
import * as LearningProgress from '@modules/learning-progress/learning-progress.routes.js'

useIf('/leaderboard', Leaderboard, 'leaderboardRoutes')
useIf('/learning-progress', LearningProgress, 'learningProgressRoutes')

/** ---------------- notifications ---------------- */
import * as Notifications from '@modules/notifications/notification.routes.js'
import * as Discussions from '@modules/notifications/discussions.routes.js'

useIf('/notifications', Notifications, 'notificationRoutes')
useIf('/discussions', Discussions, 'discussionsRoutes')

/** ---------------- orgs ---------------- */
import * as Orgs from '@modules/orgs/org.routes.js'
import * as OrgUsers from '@modules/orgs/org-user.routes.js'

useIf('/orgs', Orgs, 'orgRoutes')
useIf('/org-users', OrgUsers, 'orgUserRoutes')

/** ---------------- questions ---------------- */
import * as Questions from '@modules/questions/question.routes.js'
useIf('/questions', Questions, 'questionRoutes')

/**
 * ---------------- roles / menus ----------------
 * 子路由文件里已自带 '/roles'、'/menus' 前缀，这里挂在根路径即可，
 * 避免出现 '/roles/roles'、'/menus/menus'。
 */
import * as Roles from '@modules/roles/role.routes.js'
import * as Menus from '@modules/roles/menu.routes.js'

useIf('/', Roles, 'roleRoutes')
useIf('/', Menus, 'menuRoutes')

/** ---------------- tasks / users / wrong-questions ---------------- */
import * as Tasks from '@modules/tasks/task.routes.js'
import * as Users from '@modules/users/user.routes.js'
import * as WrongQuestions from '@modules/wrong-questions/wrong-question.routes.js'

useIf('/tasks', Tasks, 'taskRoutes')
useIf('/users', Users, 'userRoutes')
useIf('/wrong-questions', WrongQuestions, 'wrongQuestionRoutes')

export default router
