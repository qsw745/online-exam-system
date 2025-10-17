// apps/backend/src/routes/index.ts（或你的路由聚合文件）
import { Router } from 'express'

// auth
import * as authRoutesMod from '@/modules/auth/routes/auth.routes'
import * as pwdResetRoutesMod from '@/modules/auth/routes/password-reset.routes'
// users
import * as userRoutesMod from '@/modules/users/routes/user.routes'
// orgs（已合并 org-user 子路由）
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
// NEW: messages & todos
import * as messageRoutesMod from '@/modules/messages/routes/message.routes'
import * as todoRoutesMod from '@/modules/todos/routes/todo.routes'
// discussions
import * as discussionsRoutesMod from '@/modules/discussions/routes/discussions.routes'
// learning-progress
import * as learningProgressRoutesMod from '@/modules/learning-progress/routes/learning-progress.routes'
// tasks
import * as taskRoutesMod from '@/modules/tasks/routes/task.routes'
// wrong-questions
import * as wrongQuestionRoutesMod from '@/modules/wrong-questions/routes/wrong-question.routes'
import * as adminSettingsRoutesMod from '@/modules/admin-settings/routes/admin-settings.routes'
import * as profileRoutesMod from '@/modules/profile/routes/profile.routes'

import * as captchaRoutesMod from '@/modules/auth/routes/captcha.routes'
import * as cryptoRoutesMod from '@/modules/auth/routes/crypto.routes'
import * as publicRoutesMod from '@/modules/admin-settings/routes/public.routes'

const pick = (mod: any, ...keys: string[]) => (keys.map(k => mod?.[k]).find(Boolean) ?? mod?.default) as any

const authRoutes = pick(authRoutesMod, 'authRoutes')
const passwordResetRoutes = pick(pwdResetRoutesMod, 'passwordResetRoutes')
const userRoutes = pick(userRoutesMod, 'userRoutes')
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
// NEW
const messageRoutes = pick(messageRoutesMod, 'messageRoutes')
const todoRoutes = pick(todoRoutesMod, 'todoRoutes')

const discussionsRoutes = pick(discussionsRoutesMod, 'discussionsRoutes')
const learningProgressRoutes = pick(learningProgressRoutesMod, 'learningProgressRoutes')
const taskRoutes = pick(taskRoutesMod, 'taskRoutes')
const wrongQuestionRoutes = pick(wrongQuestionRoutesMod, 'wrongQuestionRoutes')
const adminSettingsRoutes = pick(adminSettingsRoutesMod, 'adminSettingsRoutes')
const profileRoutes = pick(profileRoutesMod, 'profileRoutes')
const captchaRoutes = pick(captchaRoutesMod, 'captchaRoutes')
const cryptoRoutes = pick(cryptoRoutesMod, 'cryptoRoutes')
const publicRoutes = pick(publicRoutesMod, 'publicRoutes')

const router = Router()

const mounts: Array<[string, any]> = [
  ['/auth', authRoutes],
  ['/auth/password-reset', passwordResetRoutes],
  ['/users', userRoutes],
  ['/orgs', orgRoutes],
  ['/roles', roleRoutes],
  ['/menus', menusRoutes],
  ['/favorites', favoritesRoutes],
  ['/questions', questionRoutes],
  ['/exams', examRoutes],
  ['/papers', paperRoutes],
  ['/results', resultRoutes],
  ['/leaderboard', leaderboardRoutes],
  ['/analytics', analyticsRoutes],
  ['/dashboard', dashboardRoutes],
  ['/logs', logRoutes],
  ['/notifications', notificationRoutes],
  // NEW: 前端正在调用的两个模块
  ['/messages', messageRoutes],
  ['/todos', todoRoutes],
  ['/discussions', discussionsRoutes],
  ['/learning-progress', learningProgressRoutes],
  ['/tasks', taskRoutes],
  ['/wrong-questions', wrongQuestionRoutes],
  ['/admin', adminSettingsRoutes],
  ['/profile', profileRoutes],
  ['/captcha', captchaRoutes],
  ['/crypto', cryptoRoutes],
  ['/public', publicRoutes],
]

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
