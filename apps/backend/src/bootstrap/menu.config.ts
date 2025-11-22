// --- 统一：component 采用“前端注册表里的 key” ---

/** 和仓库白名单保持一致 */
export type MenuType = 'menu' | 'page' | 'link' | 'button' | 'iframe' | 'dir'

export type MenuSeed = {
  name: string
  title: string
  path?: string | null
  component?: string | null
  icon?: string | null
  menu_type?: MenuType
  is_hidden?: boolean
  is_disabled?: boolean
  is_system?: boolean
  sort_order?: number
  level?: number
  redirect?: string | null
  permission_code?: string | null
  meta?: Record<string, any> | null
  children?: MenuSeed[]
}

/* ------------------------- 小工具 -------------------------- */
const DYNAMIC_RE = /[:\[\{]/
const hasDynamic = (p?: string | null) => !!(p && DYNAMIC_RE.test(p))
const ensureAbsPath = (p?: string | null): string | null => {
  if (!p) return null
  const t = String(p).trim()
  if (!t) return null
  return t.startsWith('/') ? t : `/${t}`
}

/** 找第一个可用于跳转的非动态子路径（用于目录 redirect） */
function firstNonDynamicChildPath(children?: MenuSeed[]): string | null {
  if (!children?.length) return null
  for (const c of children) {
    const p = ensureAbsPath(c.path)
    if (p && !hasDynamic(p)) return p
    const deep = firstNonDynamicChildPath(c.children)
    if (deep) return deep
  }
  return null
}

/** 目录节点：强制 menu_type=menu；保留/清空 path 均可，这里保留传入 path */
function asDir(n: MenuSeed): MenuSeed {
  return { ...n, menu_type: 'menu', component: null }
}

/** 叶子节点：路径绝对化；动态路径默认隐藏（可被 is_hidden 显式覆盖） */
function normalizeLeaf(n: MenuSeed): MenuSeed {
  const t = (n.menu_type ?? 'page') as MenuType
  const path = ensureAbsPath(n.path)
  const hiddenByDynamic = hasDynamic(path) ? true : undefined
  return {
    ...n,
    menu_type: t,
    path,
    is_hidden: typeof n.is_hidden === 'boolean' ? n.is_hidden : hiddenByDynamic ?? false,
  }
}

/* ------------------------- 规范化（不限层级） -------------------------- */
/**
 * 不再压成两层；保留任意层级：
 * - 有 children => 目录（menu），自动补 redirect（优先显式 redirect 其后找第一个可跳转子路径）
 * - 无 children => 叶子（page/link/iframe/button），做基本清洗
 */
function normalizeAnyDepth(nodes: MenuSeed[] | undefined): MenuSeed[] {
  if (!nodes?.length) return []
  const out: MenuSeed[] = []
  for (const raw of nodes) {
    const children = Array.isArray(raw.children) ? raw.children : []
    if (children.length) {
      const normalizedChildren = normalizeAnyDepth(children)
      out.push({
        ...asDir(raw),
        path: ensureAbsPath(raw.path), // 目录可保留自身 path（若不想能点可设为 null）
        redirect: raw.redirect ?? firstNonDynamicChildPath(normalizedChildren) ?? null,
        children: normalizedChildren,
      })
    } else {
      out.push(normalizeLeaf({ ...raw, children: undefined }))
    }
  }
  // 稳定排序
  out.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  return out
}

/* ------------------------- 原始种子（任意层） -------------------------- */
const RAW_MENU: MenuSeed[] = [
  // ===== 根目录占位：仅用于层级控制，默认隐藏 =====
  {
    name: 'root',
    title: '根目录',
    path: null,
    component: null,
    icon: 'home',
    menu_type: 'menu',
    sort_order: 0,
    is_hidden: true,
    is_system: true,
  },

  // ===== 仪表盘 =====
  {
    name: 'dashboard',
    title: '仪表盘',
    path: '/dashboard',
    component: 'dashboard',
    icon: 'dashboard',
    menu_type: 'page',
    is_system: true,
    sort_order: 10,
    meta: { keepAlive: false, requireAuth: true },
    permission_code: 'dashboard:view',
  },

  // ===== 学习中心（学员）=====
  {
    name: 'learning',
    title: '学习中心',
    path: '/learning',
    icon: 'book',
    menu_type: 'menu',
    sort_order: 20,
    redirect: '/learning/progress',
    meta: { requireAuth: true },
    permission_code: 'learning:view',
    children: [
      {
        name: 'learning-progress',
        title: '学习进度',
        path: '/learning/progress',
        component: 'learning-progress',
        menu_type: 'page',
        sort_order: 1,
        meta: { requireAuth: true, keepAlive: true },
        permission_code: 'learning:progress',
      },
      {
        name: 'learning-practice',
        title: '题目练习',
        path: '/learning/practice',
        component: 'question-practice',
        menu_type: 'page',
        sort_order: 2,
        meta: { requireAuth: true, keepAlive: true },
        permission_code: 'learning:practice',
      },
      {
        name: 'learning-favorites',
        title: '我的收藏',
        path: '/learning/favorites',
        component: 'favorites',
        menu_type: 'page',
        sort_order: 3,
        meta: { requireAuth: true, keepAlive: true },
        permission_code: 'learning:favorites',
      },
      {
        name: 'learning-wrong',
        title: '错题本',
        path: '/learning/wrong-questions',
        component: 'wrong-questions',
        menu_type: 'page',
        sort_order: 4,
        meta: { requireAuth: true, keepAlive: true },
        permission_code: 'learning:wrong',
      },
      {
        name: 'learning-discussion',
        title: '讨论区',
        path: '/learning/discussion',
        component: 'discussion',
        menu_type: 'page',
        sort_order: 5,
        meta: { requireAuth: true },
        permission_code: 'learning:discussion',
      },
      {
        name: 'learning-leaderboard',
        title: '排行榜',
        path: '/learning/leaderboard',
        component: 'leaderboard',
        menu_type: 'page',
        sort_order: 6,
        meta: { requireAuth: true },
        permission_code: 'learning:leaderboard',
      },
    ],
  },

  // ===== 通知中心（学员）【新增】=====
  {
    name: 'notify-center',
    title: '通知中心',
    path: '/notify',
    icon: 'bell',
    menu_type: 'menu',
    sort_order: 27,
    redirect: '/notify/inbox',
    meta: { requireAuth: true },
    permission_code: 'notify:view',
    children: [
      {
        name: 'notify-inbox',
        title: '收件箱',
        path: '/notify/inbox',
        component: 'notify-inbox',
        menu_type: 'page',
        sort_order: 1,
        meta: { requireAuth: true, keepAlive: true },
        permission_code: 'notify:inbox',
      },
      {
        name: 'notify-announcements',
        title: '公告',
        path: '/notify/announcements',
        component: 'notify-announcements',
        menu_type: 'page',
        sort_order: 2,
        meta: { requireAuth: true, keepAlive: true },
        permission_code: 'notify:announcements',
      },
      {
        name: 'notify-preferences',
        title: '订阅与偏好',
        path: '/notify/preferences',
        component: 'notify-preferences',
        menu_type: 'page',
        sort_order: 3,
        meta: { requireAuth: true },
        permission_code: 'notify:preferences',
      },
      {
        name: 'notify-detail',
        title: '通知详情',
        path: '/notify/detail/:id',
        component: 'notify-detail',
        menu_type: 'page',
        sort_order: 9,
        is_hidden: true,
        meta: { requireAuth: true },
        permission_code: 'notify:detail',
      },
    ],
  },

  // ===== 任务中心（学员）=====
  {
    name: 'task-center',
    title: '任务中心',
    path: '/tasks',
    icon: 'calendar',
    menu_type: 'menu',
    sort_order: 25,
    redirect: '/tasks/my',
    meta: { requireAuth: true },
    permission_code: 'tasks:view',
    children: [
      {
        name: 'tasks-my',
        title: '我的任务',
        path: '/tasks/my',
        component: 'task-my',
        menu_type: 'page',
        sort_order: 1,
        meta: { requireAuth: true, keepAlive: true },
        permission_code: 'tasks:my',
      },
      {
        name: 'tasks-detail',
        title: '任务详情',
        path: '/tasks/detail/:id',
        component: 'task-detail',
        menu_type: 'page',
        sort_order: 2,
        is_hidden: true,
        meta: { requireAuth: true },
        permission_code: 'tasks:detail',
      },
    ],
  },

  // ===== 考试中心（学员）=====
  {
    name: 'exam',
    title: '考试中心',
    path: '/exam',
    icon: 'file-text',
    menu_type: 'menu',
    sort_order: 30,
    redirect: '/exam/list',
    meta: { requireAuth: true },
    permission_code: 'exam:view',
    children: [
      {
        name: 'exam-list',
        title: '考试列表',
        path: '/exam/list',
        component: 'exam-list',
        menu_type: 'page',
        sort_order: 1,
        meta: { requireAuth: true, keepAlive: true },
        permission_code: 'exam:list',
      },
      {
        name: 'exam-results',
        title: '我的成绩',
        path: '/exam/results',
        component: 'results',
        menu_type: 'page',
        sort_order: 2,
        meta: { requireAuth: true, keepAlive: true },
        permission_code: 'exam:results',
      },
    ],
  },

  // ===== 题库浏览（前台）=====
  {
    name: 'question',
    title: '题库',
    path: '/questions',
    icon: 'question-circle',
    menu_type: 'menu',
    sort_order: 40,
    redirect: '/questions/browse',
    meta: { requireAuth: true },
    permission_code: 'question:view',
    children: [
      {
        name: 'question-browse',
        title: '题库浏览',
        path: '/questions/browse',
        component: 'questions',
        menu_type: 'page',
        sort_order: 1,
        meta: { requireAuth: true, keepAlive: true },
        permission_code: 'question:browse',
      },
    ],
  },

  // ===== 数据分析 / 个人资料（单页）=====
  {
    name: 'analytics',
    title: '数据分析',
    path: '/analytics',
    component: 'analytics',
    icon: 'bar-chart',
    menu_type: 'page',
    sort_order: 50,
    meta: { requireAuth: true, keepAlive: true },
    permission_code: 'analytics:view',
  },
  {
    name: 'profile',
    title: '个人资料',
    path: '/profile',
    component: 'profile',
    icon: 'user',
    menu_type: 'page',
    sort_order: 60,
    meta: { requireAuth: true, keepAlive: true },
    permission_code: 'profile:view',
  },

  // ===== 邮件管理（与系统管理同级）=====
  {
    name: 'system-mail',
    title: '邮件管理',
    path: '/mail',
    icon: 'mail',
    menu_type: 'menu',
    sort_order: 90,
    redirect: '/mail/inbox',
    meta: { requireAuth: true },
    permission_code: 'system:mail',
    children: [
      {
        name: 'mail-inbox',
        title: '收件箱',
        path: '/mail/inbox',
        component: 'mail-inbox',
        menu_type: 'page',
        sort_order: 1,
        permission_code: 'mail:inbox',
      },
      {
        name: 'mail-compose',
        title: '写邮件',
        path: '/mail/compose',
        component: 'mail-compose',
        menu_type: 'page',
        sort_order: 2,
        permission_code: 'mail:compose',
      },
      {
        name: 'mail-sent',
        title: '发件箱',
        path: '/mail/sent',
        component: 'mail-sent',
        menu_type: 'page',
        sort_order: 3,
        permission_code: 'mail:sent',
      },
      {
        name: 'mail-draft',
        title: '草稿箱',
        path: '/mail/drafts',
        component: 'mail-draft',
        menu_type: 'page',
        sort_order: 4,
        permission_code: 'mail:draft',
      },
    ],
  },

  // ===== 系统管理（后台）=====
  {
    name: 'admin',
    title: '系统管理',
    path: '/admin',
    icon: 'setting',
    menu_type: 'menu',
    sort_order: 100,
    is_system: true,
    redirect: '/admin/orgs',
    meta: { requireAuth: true },
    children: [
      {
        name: 'admin-user',
        title: '用户管理',
        path: '/admin/users',
        component: 'admin-user',
        menu_type: 'page',
        sort_order: 1,
        permission_code: 'system:user',
      },
      {
        name: 'admin-org',
        title: '部门管理',
        path: '/admin/orgs',
        component: 'admin-org',
        menu_type: 'page',
        sort_order: 2,
        permission_code: 'system:org',
      },
      {
        name: 'admin-role',
        title: '角色管理',
        path: '/admin/roles',
        component: 'admin-role',
        menu_type: 'page',
        sort_order: 3,
        permission_code: 'system:role',
      },

      // —— 考试管理（出题/组卷/成绩）——
      {
        name: 'exam-admin',
        title: '考试管理',
        path: '/admin/exams',
        icon: 'file-done',
        menu_type: 'menu',
        sort_order: 60,
        redirect: '/admin/questions',
        meta: { requireAuth: true },
        permission_code: 'system:exams',
        children: [
          {
            name: 'admin-questions',
            title: '题库管理',
            path: '/admin/questions',
            component: 'question-manage',
            menu_type: 'page',
            sort_order: 1,
            permission_code: 'question:manage',
          },
          {
            name: 'admin-papers',
            title: '试卷管理',
            path: '/admin/papers',
            component: 'paper-manage',
            menu_type: 'page',
            sort_order: 2,
            permission_code: 'paper:manage',
          },
          {
            name: 'admin-papers-smart',
            title: '智能组卷',
            path: '/admin/papers/create/smart',
            component: 'paper-create-smart',
            menu_type: 'page',
            sort_order: 3,
            permission_code: 'paper:create:smart',
          },
          {
            name: 'admin-papers-manual',
            title: '手动组卷',
            path: '/admin/papers/create/manual',
            component: 'paper-create-manual',
            menu_type: 'page',
            sort_order: 4,
            permission_code: 'paper:create:manual',
          },
          {
            name: 'admin-grades',
            title: '成绩管理',
            path: '/admin/exams/grades',
            component: 'grade-management',
            menu_type: 'page',
            sort_order: 5,
            permission_code: 'exam:grades',
          },
        ],
      },

      // —— 任务管理（分发/发布）——
      {
        name: 'system-tasks',
        title: '任务管理',
        path: '/admin/tasks',
        icon: 'calendar',
        menu_type: 'menu',
        sort_order: 70,
        redirect: '/admin/tasks/list',
        meta: { requireAuth: true },
        permission_code: 'system:tasks',
        children: [
          {
            name: 'task-list',
            title: '任务列表',
            path: '/admin/tasks/list',
            component: 'task-manage',
            menu_type: 'page',
            sort_order: 1,
            meta: { requireAuth: true },
            permission_code: 'system:tasks:list',
          },
          {
            name: 'task-create',
            title: '创建任务',
            path: '/admin/tasks/create',
            component: 'task-create',
            menu_type: 'page',
            sort_order: 2,
            meta: { requireAuth: true },
            permission_code: 'system:tasks:create',
          },
          {
            name: 'task-detail-admin',
            title: '任务详情',
            path: '/admin/tasks/detail/:id',
            component: 'task-detail',
            menu_type: 'page',
            sort_order: 3,
            is_hidden: true,
            meta: { requireAuth: true },
            permission_code: 'system:tasks:detail',
          },
        ],
      },

      // —— 通知管理（公告/模板/渠道/群发/日志）【新增】——
      {
        name: 'system-notify',
        title: '通知管理',
        path: '/admin/notify',
        icon: 'bell',
        menu_type: 'menu',
        sort_order: 80,
        redirect: '/admin/notify/announcements',
        meta: { requireAuth: true },
        permission_code: 'system:notify',
        children: [
          {
            name: 'notify-announce-manage',
            title: '公告管理',
            path: '/admin/notify/announcements',
            component: 'notify-announce-manage',
            menu_type: 'page',
            sort_order: 1,
            permission_code: 'notify:announce:manage',
          },
          {
            name: 'notify-template',
            title: '消息模板',
            path: '/admin/notify/templates',
            component: 'notify-template',
            menu_type: 'page',
            sort_order: 2,
            permission_code: 'notify:template',
          },
          {
            name: 'notify-channel',
            title: '推送渠道',
            path: '/admin/notify/channels',
            component: 'notify-channel',
            menu_type: 'page',
            sort_order: 3,
            permission_code: 'notify:channel',
          },
          {
            name: 'notify-send',
            title: '消息群发/测试',
            path: '/admin/notify/send',
            component: 'notify-send',
            menu_type: 'page',
            sort_order: 4,
            permission_code: 'notify:send',
          },
          {
            name: 'notify-log',
            title: '推送日志',
            path: '/admin/notify/logs',
            component: 'notify-log',
            menu_type: 'page',
            sort_order: 5,
            permission_code: 'notify:log',
          },
        ],
      },

      {
        name: 'system-settings',
        title: '系统设置',
        path: '/admin/settings',
        component: 'system-settings',
        icon: 'setting',
        menu_type: 'page',
        sort_order: 90,
        meta: { requireAuth: true },
        permission_code: 'system:settings',
      },

      {
        name: 'system-logs',
        title: '系统监控',
        path: '/admin/logs',
        menu_type: 'menu',
        sort_order: 95, // 补充排序，避免默认值导致顺序紊乱
        redirect: '/admin/logs/login',
        children: [
          {
            name: 'system-logs-online',
            title: '在线用户',
            path: '/admin/logs/online',
            component: 'online-users',
            menu_type: 'page',
            sort_order: 1,
          },
          {
            name: 'system-logs-login',
            title: '登录日志',
            path: '/admin/logs/login',
            component: 'logs-login',
            menu_type: 'page',
            sort_order: 2,
          },
          {
            name: 'system-logs-ops',
            title: '操作日志',
            path: '/admin/logs/ops',
            component: 'logs-ops',
            menu_type: 'page',
            sort_order: 3,
          },
          {
            name: 'system-logs-system',
            title: '系统日志',
            path: '/admin/logs/system',
            component: 'logs-system',
            menu_type: 'page',
            sort_order: 4,
          },
        ],
      },

      // —— 文件中心【新增】——
      {
        name: 'system-files',
        title: '文件中心',
        path: '/admin/files',
        icon: 'folder',
        menu_type: 'menu',
        sort_order: 96,
        redirect: '/admin/files/library',
        meta: { requireAuth: true },
        permission_code: 'system:files',
        children: [
          {
            name: 'files-library',
            title: '文件库',
            path: '/admin/files/library',
            component: 'files-library',
            menu_type: 'page',
            sort_order: 1,
            permission_code: 'files:library',
          },
          {
            name: 'files-upload',
            title: '上传管理',
            path: '/admin/files/uploads',
            component: 'files-uploads',
            menu_type: 'page',
            sort_order: 2,
            permission_code: 'files:uploads',
          },
        ],
      },

      // —— 字典/参数/任务/缓存【新增】——
      {
        name: 'system-dict',
        title: '字典管理',
        path: '/admin/dicts',
        component: 'system-dict',
        icon: 'book',
        menu_type: 'page',
        sort_order: 97,
        meta: { requireAuth: true },
        permission_code: 'system:dict',
      },
      {
        name: 'system-config',
        title: '参数设置',
        path: '/admin/config',
        component: 'system-config',
        icon: 'sliders',
        menu_type: 'page',
        sort_order: 98,
        meta: { requireAuth: true },
        permission_code: 'system:config',
      },
      {
        name: 'system-jobs',
        title: '定时任务',
        path: '/admin/jobs',
        component: 'system-jobs',
        icon: 'clock',
        menu_type: 'page',
        sort_order: 99,
        meta: { requireAuth: true },
        permission_code: 'system:jobs',
      },
      {
        name: 'system-cache',
        title: '缓存管理',
        path: '/admin/cache',
        component: 'system-cache',
        icon: 'database',
        menu_type: 'page',
        sort_order: 100,
        meta: { requireAuth: true },
        permission_code: 'system:cache',
      },

      // —— 集成管理（Webhooks/OAuth）【新增】——
      {
        name: 'system-integrations',
        title: '集成管理',
        path: '/admin/integrations',
        icon: 'api',
        menu_type: 'menu',
        sort_order: 101,
        redirect: '/admin/integrations/webhooks',
        meta: { requireAuth: true },
        permission_code: 'system:integrations',
        children: [
          {
            name: 'integrations-webhooks',
            title: 'Webhooks',
            path: '/admin/integrations/webhooks',
            component: 'integrations-webhooks',
            menu_type: 'page',
            sort_order: 1,
            permission_code: 'integrations:webhooks',
          },
          {
            name: 'integrations-oauth',
            title: 'OAuth应用',
            path: '/admin/integrations/oauth',
            component: 'integrations-oauth',
            menu_type: 'page',
            sort_order: 2,
            permission_code: 'integrations:oauth',
          },
        ],
      },

      // —— 菜单管理 ——
      {
        name: 'system-menus',
        title: '菜单管理',
        path: '/admin/menus',
        component: 'menu-list',
        icon: 'menu',
        menu_type: 'page',
        sort_order: 110,
        meta: { requireAuth: true },
        permission_code: 'system:menus',
      },
    ],
  },

  // ===== 错误页 =====
  {
    name: 'error-management',
    title: '错误页面管理',
    path: '/errors',
    icon: 'warning',
    menu_type: 'menu',
    sort_order: 200,
    is_system: true,
    redirect: '/errors/404',
    children: [
      {
        name: 'errors-403',
        title: '403 无权限',
        path: '/errors/403',
        component: 'errors-403',
        menu_type: 'page',
        sort_order: 1,
      },
      {
        name: 'errors-404',
        title: '404 未找到',
        path: '/errors/404',
        component: 'errors-404',
        menu_type: 'page',
        sort_order: 2,
      },
      {
        name: 'errors-500',
        title: '500 服务器错误',
        path: '/errors/500',
        component: 'errors-500',
        menu_type: 'page',
        sort_order: 3,
      },
    ],
  },
]

/* ------------------------- 导出：保留多层树 & 扁平列表 -------------------------- */

/** 多层树（不限层级），用于系统表同步 / 前端动态路由 */
export const MENU_TREE: MenuSeed[] = normalizeAnyDepth(RAW_MENU)

/** 扁平列表（带 level/parentName），DFS 展开 */
export const MENU_FLAT: Array<MenuSeed & { level: number; parentName?: string | null }> = (() => {
  const out: Array<MenuSeed & { level: number; parentName?: string | null }> = []
  const dfs = (nodes: MenuSeed[], level: number, parentName: string | null) => {
    for (const n of nodes) {
      const { children, ...self } = n
      out.push({ ...(self as any), level, parentName })
      if (children?.length) dfs(children, level + 1, n.name)
    }
  }
  dfs(MENU_TREE, 1, null)
  return out
})()

/** 可选：导出冻结版本，避免运行时被篡改 */
function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === 'object') {
    Object.freeze(obj as any)
    for (const k of Object.keys(obj as any)) {
      // @ts-ignore
      deepFreeze((obj as any)[k])
    }
  }
  return obj
}

deepFreeze(MENU_TREE)
deepFreeze(MENU_FLAT)

export default MENU_TREE
