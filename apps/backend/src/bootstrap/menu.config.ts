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
 * 规则：
 *  - 顶层：有 children → 目录(menu)，path=null，redirect 指向第一个可用子路径
 *          无 children → 包为 目录(menu) + 同名子页(page)
 *  - 第二层：
 *      - 无 children → 直接是 page（不再包目录）
 *      - 有且仅 1 个 child 且等价 → 合并为 1 个 page（采用 child 的 path/component）
 *      - 有多个 child → 将所有 child **扁平化** 成第二层 page（name 以 `parent-child` 防冲突）
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
                    path: null,      // ★ 避免父子同 path
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
                    path: null,      // 目录 path 置空
                    redirect: n.path || n.redirect || null,
                    children: [child],
                })
            }
            continue
        }

        // depth === 2：生成“第二层页面”
        if (children.length === 0) {
            // 二级叶子：就是 page
            out.push({
                ...n,
                menu_type: 'page',
                children: undefined,
            })
            continue
        }

        // 二级还有下一级
        if (children.length === 1 && roughlyEqual(n, children[0])) {
            // 与唯一子项等价 → 合并为一个二级 page
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

        // 有多个子项 → 全部扁平为第二层 page（不保留第三级）
        for (const gc of children) {
            out.push({
                name: `${n.name}-${gc.name}`,         // 防止 name 冲突
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

/** ===== 原始种子：可以包含单层 / 多层，最终会被压缩为“最多两层” ===== */
const RAW_MENU: MenuSeed[] = [
    // ===== 概览（单层，压缩后变：仪表盘(目录) -> 仪表盘(页面)）=====
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

    // ===== 考试中心（学员/监考）=====
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
                title: '考试结果',
                path: '/exam/results',
                component: 'results',
                menu_type: 'page',
                sort_order: 2,
                meta: { requireAuth: true, keepAlive: true },
                permission_code: 'exam:results',
            },
        ],
    },

    // ===== 题库（前台浏览）=====
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

    // ===== 数据分析（单层 → 目录 + 同名子页）=====
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

    // ===== 个人资料（单层 → 目录 + 同名子页）=====
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
            { name: 'admin-questions', title: '题库维护（后台）', path: '/admin/questions', component: 'question-manage', menu_type: 'page', sort_order: 10, permission_code: 'question:manage' },
            { name: 'system-settings', title: '系统设置', path: '/admin/settings', component: 'system-settings', icon: 'setting', menu_type: 'page', sort_order: 20, meta: { requireAuth: true }, permission_code: 'system:settings' },
            { name: 'system-logs', title: '系统日志', path: '/admin/logs', component: 'logs', icon: 'file-text', menu_type: 'page', sort_order: 21, meta: { requireAuth: true }, permission_code: 'system:logs' },
            {
                name: 'system-tasks',
                title: '任务管理',
                path: '/admin/tasks',
                icon: 'calendar',
                menu_type: 'menu',
                sort_order: 70,
                redirect: '/admin/tasks/public',
                meta: { requireAuth: true },
                permission_code: 'system:tasks',
                children: [
                    { name: 'task-public', title: '发布任务', path: '/admin/tasks/public', component: 'task-public', menu_type: 'page', sort_order: 1, meta: { requireAuth: true }, permission_code: 'system:tasks:public' },
                    { name: 'task-create', title: '创建任务', path: '/admin/tasks/create', component: 'task-create', menu_type: 'page', sort_order: 2, meta: { requireAuth: true }, permission_code: 'system:tasks:create' },
                    { name: 'task-my', title: '我的任务', path: '/admin/tasks/my', component: 'task-my', menu_type: 'page', sort_order: 3, meta: { requireAuth: true }, permission_code: 'system:tasks:my' },
                ],
            },
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
