// apps/backend/src/routes/index.ts
import { Router } from 'express'

// —— 统一用别名 & 不带 .js 后缀，并“容错”拾取默认/命名导出 ——
// auth
import * as authRoutesMod from '@/modules/auth/routes/auth.routes'
import * as pwdResetRoutesMod from '@/modules/auth/routes/password-reset.routes'
// users
import * as userRoutesMod from '@/modules/users/routes/user.routes'
// orgs
import * as orgUserRoutesMod from '@/modules/orgs/routes/org-user.routes'
import * as orgRoutesMod from '@/modules/orgs/routes/org.routes'
// roles & menus
import * as menusRoutesMod from '@/modules/menus/routes/menus.routes'
import * as roleRoutesMod from '@/modules/roles/routes/role.routes'
// favorites
import * as favoritesRoutesMod from '@/modules/favorites/routes/favorites.routes'
// questions
import * as questionRoutesMod from '@/modules/questions/routes/question.routes'
// exams
import * as examRoutesMod from '@/modules/exams/routes/exam.routes'
import * as paperRoutesMod from '@/modules/exams/routes/paper.routes'
import * as resultRoutesMod from '@/modules/exams/routes/result.routes'
// leaderboard
import * as leaderboardRoutesMod from '@/modules/leaderboard/routes/leaderboard.routes'
// analytics
import * as analyticsRoutesMod from '@/modules/analytics/routes/analytics.routes'
import * as dashboardRoutesMod from '@/modules/analytics/routes/dashboard.routes'
import * as logRoutesMod from '@/modules/logs/routes/log.routes'
// notifications
import * as notificationRoutesMod from '@/modules/notifications/routes/notification.routes'
// discussions
import * as discussionsRoutesMod from '@/modules/discussions/routes/discussions.routes'
// learning-progress
import * as learningProgressRoutesMod from '@/modules/learning-progress/routes/learning-progress.routes'
// tasks
import * as taskRoutesMod from '@/modules/tasks/routes/task.routes'
// wrong-questions
import * as wrongQuestionRoutesMod from '@/modules/wrong-questions/routes/wrong-question.routes'

// —— 安全拾取工具：优先命名导出，其次 default ——
// 允许模块导出形态：export const xxxRoutes = router  或 export default router
const pick = (mod: any, ...keys: string[]) => (keys.map(k => mod?.[k]).find(Boolean) ?? mod?.default) as any

const authRoutes = pick(authRoutesMod, 'authRoutes')
const passwordResetRoutes = pick(pwdResetRoutesMod, 'passwordResetRoutes')
const userRoutes = pick(userRoutesMod, 'userRoutes')
const orgUserRoutes = pick(orgUserRoutesMod, 'orgUserRoutes')
const orgRoutes = pick(orgRoutesMod, 'orgRoutes')
const menusRoutes = pick(menusRoutesMod, 'menusRoutes')
const roleRoutes = pick(roleRoutesMod, 'roleRoutes')
const favoritesRoutes = pick(favoritesRoutesMod, 'favoritesRoutes')
const questionRoutes = pick(questionRoutesMod, 'questionRoutes')
const examRoutes = pick(examRoutesMod, 'examRoutes')
const paperRoutes = pick(paperRoutesMod, 'paperRoutes')
const resultRoutes = pick(resultRoutesMod, 'resultRoutes')
const leaderboardRoutes = pick(leaderboardRoutesMod, 'leaderboardRoutes')
const analyticsRoutes = pick(analyticsRoutesMod, 'analyticsRoutes')
const dashboardRoutes = pick(dashboardRoutesMod, 'dashboardRoutes')
const logRoutes = pick(logRoutesMod, 'logRoutes')
const notificationRoutes = pick(notificationRoutesMod, 'notificationRoutes')
const discussionsRoutes = pick(discussionsRoutesMod, 'discussionsRoutes')
const learningProgressRoutes = pick(learningProgressRoutesMod, 'learningProgressRoutes')
const taskRoutes = pick(taskRoutesMod, 'taskRoutes')
const wrongQuestionRoutes = pick(wrongQuestionRoutesMod, 'wrongQuestionRoutes')

const router = Router()

// 统一挂载表
const mounts: Array<[string, any]> = [
  ['/auth', authRoutes],
  ['/auth/password-reset', passwordResetRoutes],
  ['/users', userRoutes],
  ['/orgs', orgRoutes],
  ['/orgusers', orgUserRoutes],
  ['/roles', roleRoutes],
  ['/menus', menusRoutes],
  ['/favorites', favoritesRoutes],
  ['/questions', questionRoutes],
  ['/exams', examRoutes],
  ['/papers', paperRoutes],
  ['/exam_results', resultRoutes],
  ['/leaderboard', leaderboardRoutes],
  ['/analytics', analyticsRoutes],
  ['/dashboard', dashboardRoutes],
  ['/logs', logRoutes],
  ['/notifications', notificationRoutes],
  ['/discussions', discussionsRoutes],
  ['/learning-progress', learningProgressRoutes],
  ['/tasks', taskRoutes],
  ['/wrong-questions', wrongQuestionRoutes],
]

// 逐一挂载（判定是否为 Router 实例）
let ok = 0
for (const [base, r] of mounts) {
  const inst = typeof r === 'function' && !(r as any).use && !(r as any).handle ? (r as any)() : r
  if (inst?.use && inst?.handle) {
    router.use(base, inst)
    ok++
  } else {
    console.warn(`[routes] skip mount ${base}: not an Express Router`)
  }
}
console.log(`[routes] ✅ mounted ${ok}/${mounts.length} modules`)

router.get('/', (_req, res) => res.json({ ok: true, mounted: mounts.map(m => m[0]) }))

export default router
