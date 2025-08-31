export type MenuSeed = {
  name: string // 唯一英文名（用于 upsert）
  title: string // 显示标题
  path?: string // 路由（目录节点可为空）
  component?: string // 前端 ComponentRegistry 的 key
  icon?: string | null
  menu_type?: 'menu' | 'page' | 'button'
  is_hidden?: boolean
  is_disabled?: boolean
  is_system?: boolean
  sort_order?: number
  level?: number // 可不填，自动算
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
  {
    name: 'error-management',
    title: '错误页面管理',
    path: '/errors',
    component: 'errors', // 你前端 ComponentRegistry 里建立了 'errors'
    icon: 'warning',
    menu_type: 'menu',
    is_system: true,
    sort_order: 50,
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
  {
    name: 'admin',
    title: '系统管理',
    path: '/admin',
    component: 'admin', // 可是个空壳布局页，也可以不填 component
    icon: 'setting',
    menu_type: 'menu',
    sort_order: 90,
    children: [
      {
        name: 'admin-org',
        title: '组织管理',
        path: '/orgs',
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
      // 继续加...
    ],
  },
]
