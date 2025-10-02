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
            { name: 'tasks-my', title: '我的任务', path: '/tasks/my', component: 'task-my', menu_type: 'page', sort_order: 1, meta: { requireAuth: true, keepAlive: true }, permission_code: 'tasks:my' },
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

    // ===== 数据分析 / 个人资料（单页）=====
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
