// apps/backend/src/bootstrap/menu.config.ts
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
    // ===== 概览 =====
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
            // —— 可选：消息中心（学员侧）——
            // {
            //   name: 'learning-notifications',
            //   title: '消息中心',
            //   path: '/learning/notifications',
            //   component: 'notifications',
            //   menu_type: 'page',
            //   sort_order: 7,
            //   meta: { requireAuth: true, keepAlive: true },
            //   permission_code: 'learning:notifications',
            // },
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
            // —— 可选扩展（按需放开）——
            // { name: 'exam-calendar', title: '考试日历', path: '/exam/calendar', component: 'exam-calendar', menu_type: 'page', sort_order: 3, is_hidden: true, meta: { requireAuth: true }, permission_code: 'exam:calendar' },
            // { name: 'exam-cert', title: '证书中心', path: '/exam/certificates', component: 'exam-cert', menu_type: 'page', sort_order: 4, is_hidden: true, meta: { requireAuth: true }, permission_code: 'exam:cert' },
        ],
    },

    // ===== 题库（前台浏览；后台维护见系统管理）=====
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

    // ===== 数据分析 =====
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
        // —— 可选：细分维度 ——
        // children: [
        //   { name: 'analytics-learning', title: '学习分析', path: '/analytics/learning', component: 'analytics-learning', menu_type: 'page', sort_order: 1, permission_code: 'analytics:learning' },
        //   { name: 'analytics-exam', title: '考试分析', path: '/analytics/exam', component: 'analytics-exam', menu_type: 'page', sort_order: 2, permission_code: 'analytics:exam' },
        // ],
    },

    // ===== 个人资料 =====
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
            // ★ 新增：用户管理（你已有页面）
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
                title: '组织管理',
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

            // 题库后台维护
            {
                name: 'admin-questions',
                title: '题库维护（后台）',
                path: '/admin/questions',
                component: 'question-manage',
                menu_type: 'page',
                sort_order: 10,
                permission_code: 'question:manage',
                // —— 常用按钮级权限（示例）——
                // children: [
                //   { name: 'btn-question-create', title: '新增题目', menu_type: 'button', permission_code: 'question:create' },
                //   { name: 'btn-question-edit', title: '编辑题目', menu_type: 'button', permission_code: 'question:edit' },
                //   { name: 'btn-question-delete', title: '删除题目', menu_type: 'button', permission_code: 'question:delete' },
                //   { name: 'btn-question-import', title: '导入题目', menu_type: 'button', permission_code: 'question:import' },
                //   { name: 'btn-question-export', title: '导出题目', menu_type: 'button', permission_code: 'question:export' },
                // ],
            },

            {
                name: 'system-settings',
                title: '系统设置',
                path: '/admin/settings',
                component: 'system-settings',
                icon: 'setting',
                menu_type: 'page',
                sort_order: 20,
                meta: { requireAuth: true },
                permission_code: 'system:settings',
            },
            {
                name: 'system-logs',
                title: '系统日志',
                path: '/admin/logs',
                component: 'logs',
                icon: 'file-text',
                menu_type: 'page',
                sort_order: 21,
                meta: { requireAuth: true },
                permission_code: 'system:logs',
            },

            // 任务管理（后台）
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
                    {
                        name: 'task-public',
                        title: '发布任务',
                        path: '/admin/tasks/public',
                        component: 'task-public',
                        menu_type: 'page',
                        sort_order: 1,
                        meta: { requireAuth: true },
                        permission_code: 'system:tasks:public',
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
                ],
            },

            // 菜单管理
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
                    {
                        name: 'system-menus-functional',
                        title: '功能菜单',
                        path: '/admin/menus/functional',
                        component: 'menu-functions',
                        menu_type: 'page',
                        sort_order: 1,
                        meta: { requireAuth: true },
                        permission_code: 'system:menus:functional',
                        is_system: true,
                    },
                    {
                        name: 'system-menus-unit',
                        title: '单位菜单',
                        path: '/admin/menus/unit',
                        component: 'menu-units',
                        menu_type: 'page',
                        sort_order: 2,
                        meta: { requireAuth: true },
                        permission_code: 'system:menus:unit',
                    },
                ],
            },

            // —— 可选：考试运维（后台）——
            // {
            //   name: 'admin-exam-ops',
            //   title: '考试运维',
            //   path: '/admin/exam-ops',
            //   icon: 'monitor',
            //   menu_type: 'menu',
            //   sort_order: 120,
            //   redirect: '/admin/exam-ops/papers',
            //   permission_code: 'exam:ops',
            //   children: [
            //     { name: 'admin-papers', title: '试卷管理', path: '/admin/exam-ops/papers', component: 'admin-papers', menu_type: 'page', sort_order: 1, permission_code: 'paper:manage' },
            //     { name: 'admin-exams', title: '考试编排', path: '/admin/exam-ops/schedule', component: 'admin-exam-schedule', menu_type: 'page', sort_order: 2, permission_code: 'exam:schedule' },
            //     { name: 'admin-invigilation', title: '在线监考', path: '/admin/exam-ops/invigilation', component: 'admin-invigilation', menu_type: 'page', sort_order: 3, permission_code: 'exam:invigilate' },
            //     { name: 'admin-grading', title: '阅卷中心', path: '/admin/exam-ops/grading', component: 'admin-grading', menu_type: 'page', sort_order: 4, permission_code: 'exam:grade' },
            //   ],
            // },
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
