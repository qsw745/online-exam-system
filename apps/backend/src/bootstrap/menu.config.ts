// apps/backend/src/bootstrap/menu.config.ts
// --- 统一：component 采用“前端注册表里的 key” ---
export type MenuSeed = {
    name: string
    title: string
    path?: string | null
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

/** 找第一个可用于跳转的非动态子路径（用于目录 redirect） */
function firstNonDynamicChildPath(children?: MenuSeed[]): string | null {
    if (!children?.length) return null
    for (const c of children) {
        const p = (c.path || '').trim()
        if (p && !/[:\[\{]/.test(p)) return p
        const deep = firstNonDynamicChildPath(c.children)
        if (deep) return deep
    }
    return null
}

/** 二级与三级是否“等价”（标题、路径或组件其一相同即视为等价） */
function roughlyEqual(a: MenuSeed, b: MenuSeed): boolean {
    if (a.title && b.title && a.title === b.title) return true
    if (a.path && b.path && a.path === b.path) return true
    if (a.component && b.component && a.component === b.component) return true
    return false
}

/**
 * 规范化：将任意树“压缩”为 **最多两层**
 */
function normalizeToTwoLevels(nodes: MenuSeed[], depth = 1): MenuSeed[] {
    const out: MenuSeed[] = []

    for (const n of nodes || []) {
        const children = Array.isArray(n.children) ? n.children : []

        if (depth === 1) {
            if (children.length > 0) {
                // 顶层有子：作为目录
                const normalizedChildren = normalizeToTwoLevels(children, 2)
                const redirect = n.redirect ?? firstNonDynamicChildPath(normalizedChildren) ?? (n.path || null)
                out.push({
                    ...n,
                    component: undefined,
                    menu_type: 'menu',
                    path: null,
                    redirect,
                    children: normalizedChildren,
                })
            } else {
                // 顶层单页：包成 目录 + 同名子页
                const child: MenuSeed = {
                    name: n.name.endsWith('-index') ? n.name : `${n.name}-index`,
                    title: n.title,
                    path: n.path || null,
                    component: n.component,
                    icon: null,
                    menu_type: 'page',
                    is_hidden: n.is_hidden,
                    is_disabled: n.is_disabled,
                    is_system: n.is_system,
                    sort_order: 1,
                    redirect: null,
                    permission_code: n.permission_code,
                    meta: n.meta ? { ...n.meta } : undefined,
                }
                out.push({
                    ...n,
                    component: undefined,
                    menu_type: 'menu',
                    path: null,
                    redirect: n.path || n.redirect || null,
                    children: [child],
                })
            }
            continue
        }

        // depth === 2：生成二级页面
        if (children.length === 0) {
            out.push({ ...n, menu_type: 'page', children: undefined })
            continue
        }

        if (children.length === 1 && roughlyEqual(n, children[0])) {
            const only = children[0]
            out.push({
                ...n,
                title: n.title || only.title,
                path: only.path ?? n.path ?? null,
                component: only.component ?? n.component,
                menu_type: 'page',
                children: undefined,
            })
            continue
        }

        for (const gc of children) {
            out.push({
                name: `${n.name}-${gc.name}`,
                title: gc.title,
                path: gc.path ?? null,
                component: gc.component,
                icon: null,
                menu_type: 'page',
                is_hidden: gc.is_hidden,
                is_disabled: gc.is_disabled,
                is_system: gc.is_system ?? n.is_system,
                sort_order: gc.sort_order,
                redirect: null,
                permission_code: gc.permission_code,
                meta: gc.meta,
            })
        }
    }

    return out
}

/** ===== 原始种子：最终会被压缩为“最多两层” ===== */
const RAW_MENU: MenuSeed[] = [
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
            { name: 'learning-progress', title: '学习进度', path: '/learning/progress', component: 'learning-progress', menu_type: 'page', sort_order: 1, meta: { requireAuth: true, keepAlive: true }, permission_code: 'learning:progress' },
            { name: 'learning-practice', title: '题目练习', path: '/learning/practice', component: 'question-practice', menu_type: 'page', sort_order: 2, meta: { requireAuth: true, keepAlive: true }, permission_code: 'learning:practice' },
            { name: 'learning-favorites', title: '我的收藏', path: '/learning/favorites', component: 'favorites', menu_type: 'page', sort_order: 3, meta: { requireAuth: true, keepAlive: true }, permission_code: 'learning:favorites' },
            { name: 'learning-wrong', title: '错题本', path: '/learning/wrong-questions', component: 'wrong-questions', menu_type: 'page', sort_order: 4, meta: { requireAuth: true, keepAlive: true }, permission_code: 'learning:wrong' },
            { name: 'learning-discussion', title: '讨论区', path: '/learning/discussion', component: 'discussion', menu_type: 'page', sort_order: 5, meta: { requireAuth: true }, permission_code: 'learning:discussion' },
            { name: 'learning-leaderboard', title: '排行榜', path: '/learning/leaderboard', component: 'leaderboard', menu_type: 'page', sort_order: 6, meta: { requireAuth: true }, permission_code: 'learning:leaderboard' },
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
            // 卡片式“我的任务”
            { name: 'tasks-my', title: '我的任务', path: '/tasks/my', component: 'task-my', menu_type: 'page', sort_order: 1, meta: { requireAuth: true, keepAlive: true }, permission_code: 'tasks:my' },
            // 隐藏的任务详情（从列表进入）
            { name: 'tasks-detail', title: '任务详情', path: '/tasks/detail/:id', component: 'task-detail', menu_type: 'page', sort_order: 2, is_hidden: true, meta: { requireAuth: true }, permission_code: 'tasks:detail' },
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
            { name: 'exam-list', title: '考试列表', path: '/exam/list', component: 'exam-list', menu_type: 'page', sort_order: 1, meta: { requireAuth: true, keepAlive: true }, permission_code: 'exam:list' },
            { name: 'exam-results', title: '我的成绩', path: '/exam/results', component: 'results', menu_type: 'page', sort_order: 2, meta: { requireAuth: true, keepAlive: true }, permission_code: 'exam:results' },
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
            { name: 'question-browse', title: '题库浏览', path: '/questions/browse', component: 'questions', menu_type: 'page', sort_order: 1, meta: { requireAuth: true, keepAlive: true }, permission_code: 'question:browse' },
        ],
    },

    // ===== 数据分析 / 个人资料（单页 → 自动包一层目录）=====
    { name: 'analytics', title: '数据分析', path: '/analytics', component: 'analytics', icon: 'bar-chart', menu_type: 'page', sort_order: 50, meta: { requireAuth: true, keepAlive: true }, permission_code: 'analytics:view' },
    { name: 'profile', title: '个人资料', path: '/profile', component: 'profile', icon: 'user', menu_type: 'page', sort_order: 60, meta: { requireAuth: true, keepAlive: true }, permission_code: 'profile:view' },

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
            { name: 'admin-user', title: '用户管理', path: '/admin/users', component: 'admin-user', menu_type: 'page', sort_order: 1, permission_code: 'system:user' },
            { name: 'admin-org', title: '组织管理', path: '/admin/orgs', component: 'admin-org', menu_type: 'page', sort_order: 2, permission_code: 'system:org' },
            { name: 'admin-role', title: '角色管理', path: '/admin/roles', component: 'admin-role', menu_type: 'page', sort_order: 3, permission_code: 'system:role' },

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
                    { name: 'admin-questions', title: '题库管理', path: '/admin/questions', component: 'question-manage', menu_type: 'page', sort_order: 1, permission_code: 'question:manage' },
                    { name: 'admin-papers', title: '试卷管理', path: '/admin/papers', component: 'paper-manage', menu_type: 'page', sort_order: 2, permission_code: 'paper:manage' },
                    { name: 'admin-papers-smart', title: '智能组卷', path: '/admin/papers/create/smart', component: 'paper-create-smart', menu_type: 'page', sort_order: 3, permission_code: 'paper:create:smart' },
                    { name: 'admin-papers-manual', title: '手动组卷', path: '/admin/papers/create/manual', component: 'paper-create-manual', menu_type: 'page', sort_order: 4, permission_code: 'paper:create:manual' },
                    { name: 'admin-grades', title: '成绩管理', path: '/admin/exams/grades', component: 'grade-management', menu_type: 'page', sort_order: 5, permission_code: 'exam:grades' },
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
                    { name: 'task-list', title: '任务列表', path: '/admin/tasks/list', component: 'task-manage', menu_type: 'page', sort_order: 1, meta: { requireAuth: true }, permission_code: 'system:tasks:list' },
                    { name: 'task-create', title: '创建任务', path: '/admin/tasks/create', component: 'task-create', menu_type: 'page', sort_order: 2, meta: { requireAuth: true }, permission_code: 'system:tasks:create' },
                    { name: 'task-detail-admin', title: '任务详情', path: '/admin/tasks/detail/:id', component: 'task-detail', menu_type: 'page', sort_order: 3, is_hidden: true, meta: { requireAuth: true }, permission_code: 'system:tasks:detail' },
                ],
            },

            { name: 'system-settings', title: '系统设置', path: '/admin/settings', component: 'system-settings', icon: 'setting', menu_type: 'page', sort_order: 90, meta: { requireAuth: true }, permission_code: 'system:settings' },
            { name: 'system-logs', title: '系统日志', path: '/admin/logs', component: 'logs', icon: 'file-text', menu_type: 'page', sort_order: 91, meta: { requireAuth: true }, permission_code: 'system:logs' },

            // —— 菜单管理 ——
            {
                name: 'system-menus',
                title: '菜单管理',
                path: '/admin/menus',
                icon: 'menu',
                menu_type: 'menu',
                sort_order: 110,
                redirect: '/admin/menus/functional',
                meta: { requireAuth: true },
                permission_code: 'system:menus',
                children: [
                    { name: 'system-menus-functional', title: '功能菜单', path: '/admin/menus/functional', component: 'menu-functions', menu_type: 'page', sort_order: 1, meta: { requireAuth: true }, permission_code: 'system:menus:functional', is_system: true },
                    { name: 'system-menus-unit', title: '单位菜单', path: '/admin/menus/unit', component: 'menu-units', menu_type: 'page', sort_order: 2, meta: { requireAuth: true }, permission_code: 'system:menus:unit' },
                ],
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
            { name: 'errors-403', title: '403 无权限', path: '/errors/403', component: 'errors-403', menu_type: 'page', sort_order: 1 },
            { name: 'errors-404', title: '404 未找到', path: '/errors/404', component: 'errors-404', menu_type: 'page', sort_order: 2 },
            { name: 'errors-500', title: '500 服务器错误', path: '/errors/500', component: 'errors-500', menu_type: 'page', sort_order: 3 },
        ],
    },
]

/** 导出：压缩为“最多两层”的菜单树 */
export const MENU_TREE: MenuSeed[] = normalizeToTwoLevels(RAW_MENU)
