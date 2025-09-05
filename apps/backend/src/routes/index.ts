import { Router } from 'express'

// ---------------------------------------------------------------------------
// routes/index.ts — 聚合器，仅做模块挂载；修复“router 已被重复声明”
// 关键点：文件内只能有一个 const router = Router()，不要在任何条件/分支里再次声明。
// ---------------------------------------------------------------------------

const router = Router()

// -------- 动态导入工具 ------------------------------------------------------
const pick = (mod: any, ...keys: string[]) => (keys.map(k => mod?.[k]).find(Boolean) ?? mod?.default) as any

async function tryImport(spec: string): Promise<any | null> {
  try {
    return await import(spec)
  } catch (err: any) {
    console.warn(`[routes] failed to import ${spec}:`, err?.message || err)
    return null
  }
}

async function mountAt(basePath: string, spec: string, ...keys: string[]): Promise<boolean> {
  const mod = await tryImport(spec)
  if (!mod) return false
  const r = pick(mod, ...keys)
  if (!r) {
    console.warn(`[routes] ${spec} has no export among [${keys.join(', ')}] or default`)
    return false
  }
  try {
    const inst = typeof r === 'function' && !(r.use && r.handle) ? await r() : r
    if (inst?.use && inst?.handle) {
      router.use(basePath, inst)
      console.log(`[routes] mounted ${spec} -> ${basePath}`)
      return true
    }
    console.warn(`[routes] ${spec} is not an Express Router`)
    return false
  } catch (e: any) {
    console.warn(`[routes] mount failed for ${spec}:`, e?.message || e)
    return false
  }
}

// -------- 统一挂载清单（保持与前端请求一致的前缀） -----------------------------
const TO_MOUNT: Array<{ base: string; spec: string; keys: string[] }> = [
  { base: '/auth', spec: '@modules/auth/auth.routes', keys: ['authRoutes'] },
  { base: '/users', spec: '@modules/users/user.routes', keys: ['userRoutes'] },
  { base: '/orgs', spec: '@modules/orgs/org.routes', keys: ['orgRoutes'] },
  { base: '/orgusers', spec: '@modules/orgs/org-user.routes', keys: ['orgUserRoutes'] },
  { base: '/roles', spec: '@modules/roles/role.routes', keys: ['roleRoutes'] },
  // 日志显示是 /api/menu/...（单数）
  { base: '/menu', spec: '@modules/roles/menu.routes', keys: ['menuRoutes'] },
  { base: '/favorites', spec: '@modules/favorites/favorites.routes', keys: ['favoritesRoutes', 'favoriteRoutes'] },
  { base: '/questions', spec: '@modules/questions/question.routes', keys: ['questionRoutes'] },
  { base: '/exams', spec: '@modules/exams/exam.routes', keys: ['examRoutes'] },
  // 日志显示是 /api/exam_results（下划线）
  { base: '/exam_results', spec: '@modules/exams/exam-result.routes', keys: ['examResultRoutes', 'resultRoutes'] },
  { base: '/leaderboard', spec: '@modules/leaderboard/leaderboard.routes', keys: ['leaderboardRoutes'] },
  { base: '/analytics', spec: '@modules/analytics/analytics.routes', keys: ['analyticsRoutes'] },
  // 日志显示是 /api/dashboard/stats
  { base: '/dashboard', spec: '@modules/analytics/dashboard.routes', keys: ['dashboardRoutes'] },
  { base: '/notifications', spec: '@modules/notifications/notification.routes', keys: ['notificationRoutes'] },
  { base: '/discussions', spec: '@modules/notifications/discussions.routes', keys: ['discussionsRoutes'] },
  {
    base: '/learning-progress',
    spec: '@modules/learning-progress/learning-progress.routes',
    keys: ['learningProgressRoutes'],
  },
  { base: '/tasks', spec: '@modules/tasks/task.routes', keys: ['taskRoutes'] },
]

// -------- 执行挂载（仅一次） -------------------------------------------------
async function mountAll() {
  console.log('[routes] 🚀 mounting module routes...')
  let ok = 0
  for (const item of TO_MOUNT) {
    const mounted = await mountAt(item.base, item.spec, ...item.keys)
    if (mounted) ok++
  }
  console.log(`[routes] ✅ mounted ${ok}/${TO_MOUNT.length} modules`)
}

await mountAll()

// 自检入口：GET /api
router.get('/', (_req, res) => {
  res.json({ ok: true, mounted: TO_MOUNT.map(m => m.base) })
})

export default router
