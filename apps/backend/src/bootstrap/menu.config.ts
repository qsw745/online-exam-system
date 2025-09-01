// --- 统一：component 采用“前端注册表里的 key” ---
export type MenuSeed = {
  name: string
  title: string
  path?: string
  component?: string
  icon?: string | null
  menu_type?: 'menu' | 'page' | 'button'
  is_hidden?: boolean
  is_disabled?: boolean
  is_system?: boolean
  sort_order?: number
  level?: number
  redirect?: string | null
  permission_code?: string | null
  meta?: Record<string, any>
  children?: MenuSeed[]
}

export const MENU_TREE: MenuSeed[] = [
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
  },

  // ===== 考试管理 =====
  {
    name: 'exam',
    title: '考试管理',
    path: '/exam',
    icon: 'file-text',
    menu_type: 'menu',
    sort_order: 10,
    meta: { requireAuth: true },
    permission_code: 'exam:view',
    children: [
      {
        name: 'exam-list',
        title: '考试列表',
        path: '/exam/list',
        component: 'exam-list', // 前端映射到 ExamListPage
        menu_type: 'page',
        sort_order: 2,
        meta: { requireAuth: true },
        permission_code: 'exam:list',
      },
      {
        name: 'exam-results',
        title: '考试结果',
        path: '/results',
        component: 'results', // 前端映射到 ResultsPage
        menu_type: 'page',
        sort_order: 5,
        meta: { requireAuth: true },
        permission_code: 'exam:results',
      },
      {
        name: 'exam-practice',
        title: '题目练习',
        path: '/questions/practice',
        component: 'question-practice', // 前端映射到 QuestionPracticePage
        menu_type: 'page',
        sort_order: 20,
        meta: { requireAuth: true },
        permission_code: 'exam:practice',
      },
    ],
  },

  // ===== 题库管理 =====
  {
    name: 'question',
    title: '题库管理',
    path: '/questions',
    component: 'questions', // 映射 QuestionsPage
    icon: 'question-circle',
    menu_type: 'menu',
    sort_order: 30,
    meta: { requireAuth: true },
    permission_code: 'question:view',
    children: [
      {
        name: 'question-maintain',
        title: '题库维护',
        path: '/admin/questions',
        component: 'questions', // 仍复用 QuestionsPage
        menu_type: 'page',
        sort_order: 1,
        meta: { requireAuth: true },
        // permission_code: 'question:view'
      },
    ],
  },

  // ===== 用户管理（后台）=====
  {
    name: 'user',
    title: '用户管理',
    path: '/admin/users',
    component: 'user-manage', // 前端映射到 UserManagementPage
    icon: 'user',
    menu_type: 'menu',
    sort_order: 40,
    meta: { requireAuth: true },
    permission_code: 'user:view',
  },

  // ===== 学习中心 =====
  {
    name: 'learning',
    title: '学习中心',
    path: '/learning',
    icon: 'book',
    menu_type: 'menu',
    sort_order: 120,
    meta: { requireAuth: true },
    permission_code: 'learning:view',
    children: [
      {
        name: 'learning-progress',
        title: '学习进度',
        path: '/learning/progress',
        component: 'learning-progress',
        menu_type: 'page',
        sort_order: 4,
        meta: { requireAuth: true },
        permission_code: 'learning:progress',
      },
      {
        name: 'learning-favorites',
        title: '我的收藏',
        path: '/favorites',
        component: 'favorites',
        menu_type: 'page',
        sort_order: 7,
        meta: { requireAuth: true },
        permission_code: 'learning:favorites',
      },
      {
        name: 'learning-wrong',
        title: '错题本',
        path: '/wrong-questions',
        component: 'wrong-questions',
        menu_type: 'page',
        sort_order: 11,
        meta: { requireAuth: true },
        permission_code: 'learning:wrong',
      },
      {
        name: 'learning-discussion',
        title: '讨论区',
        path: '/discussion',
        component: 'discussion',
        menu_type: 'page',
        sort_order: 14,
        meta: { requireAuth: true },
        permission_code: 'learning:discussion',
      },
      {
        name: 'learning-leaderboard',
        title: '排行榜',
        path: '/leaderboard',
        component: 'leaderboard',
        menu_type: 'page',
        sort_order: 17,
        meta: { requireAuth: true },
        permission_code: 'learning:leaderboard',
      },
    ],
  },

  // ===== 数据分析 =====
  {
    name: 'analytics',
    title: '数据分析',
    path: '/analytics',
    component: 'analytics',
    icon: 'bar-chart',
    menu_type: 'menu',
    sort_order: 130,
    meta: { requireAuth: true },
    permission_code: 'analytics:view',
  },

  // ===== 个人资料 =====
  {
    name: 'profile',
    title: '个人资料',
    path: '/profile',
    component: 'profile',
    icon: 'user',
    menu_type: 'menu',
    sort_order: 140,
    meta: { requireAuth: true },
    permission_code: 'profile:view',
  },

  // ===== 系统管理（后台）=====
  {
    name: 'admin',
    title: '系统管理',
    path: '/admin',
    icon: 'setting',
    menu_type: 'menu',
    sort_order: 100,
    is_system: false,
    children: [
      {
        name: 'admin-org',
        title: '组织管理',
        path: '/orgs', // 你的实际页面是 /orgs
        component: 'admin-org',
        menu_type: 'page',
        sort_order: 1,
      },
      {
        name: 'admin-role',
        title: '角色管理',
        path: '/admin/roles',
        component: 'admin-role',
        menu_type: 'page',
        sort_order: 2,
      },
      {
        name: 'system-settings',
        title: '系统设置',
        path: '/settings',
        component: 'settings',
        icon: 'setting',
        menu_type: 'page',
        sort_order: 3,
        meta: { requireAuth: true },
        permission_code: 'system:settings',
      },
      {
        name: 'system-logs',
        title: '系统日志',
        path: '/logs',
        component: 'logs',
        icon: 'file-text',
        menu_type: 'page',
        sort_order: 6,
        meta: { requireAuth: true },
        permission_code: 'system:logs',
      },
      {
        name: 'system-notifications',
        title: '通知管理',
        path: '/notifications',
        component: 'notifications',
        icon: 'bell',
        menu_type: 'page',
        sort_order: 60,
        meta: { requireAuth: true },
        permission_code: 'system:notifications',
      },
      {
        name: 'system-tasks',
        title: '任务管理',
        path: '/tasks',
        component: 'tasks',
        icon: 'calendar',
        menu_type: 'page',
        sort_order: 70,
        meta: { requireAuth: true },
        permission_code: 'system:tasks',
      },
      {
        name: 'system-menus',
        title: '菜单管理',
        path: '/admin/menus',
        component: 'menu-manage',
        icon: 'menu',
        menu_type: 'page',
        sort_order: 110,
        meta: { requireAuth: true },
        permission_code: 'system:menus',
      },
    ],
  },

  // ===== 错误页管理 =====
  {
    name: 'error-management',
    title: '错误页面管理',
    path: '/errors',
    component: 'errors', // 可做占位/列表
    icon: 'warning',
    menu_type: 'menu',
    sort_order: 50,
    is_system: true,
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
