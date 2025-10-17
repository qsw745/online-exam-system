// --- 统一：component 采用“前端注册表里的 key” ---
// 与后端‘菜单/路由配置表’的字段一一对应（截图里的表单项在 meta 中也有映射）

/** 和仓库白名单保持一致 */
export type MenuType = 'menu' | 'page' | 'link' | 'button' | 'iframe' | 'dir'

/** 扩展 meta：对齐表单参数（常见可选项均收敛到这里） */
export type MenuMeta = {
  /** i18n 文案 key（如 menus.pureOnlineUser） */
  i18nKey?: string | null
  /** 路由名称（如果需要和 keepAlive/缓存绑定，可用它作为缓存 key） */
  routeName?: string | null

  /** 右侧图标（如右上角小角标） */
  rightIcon?: string | null
  /** 是否缓存页面（配合 tabs/keepAlive 使用） */
  keepAlive?: boolean
  /** 固定到标签栏（affix） */
  affix?: boolean
  /** 激活菜单（activeMenu），用于详情页高亮左侧父级菜单 */
  activeMenu?: string | null
  /** 隐藏父级菜单 */
  hideParent?: boolean

  /** 进入/离场动画标识（前端自行实现映射） */
  enterTransition?: string | null
  leaveTransition?: string | null

  /** 外链（link 类型使用），target: _blank/_self */
  externalUrl?: string | null
  linkTarget?: '_blank' | '_self' | '_parent' | '_top' | null

  /** iframe（iframe 类型使用） */
  iframeSrc?: string | null

  /** 菜单右侧徽标/角标 */
  badge?: string | number | null
  /** 显隐控制：若提供则覆盖默认规则 */
  hidden?: boolean | null
}

export type MenuSeed = {
  id?: string | number
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
  meta?: MenuMeta | null
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
  const metaHidden = typeof n.meta?.hidden === 'boolean' ? n.meta.hidden : undefined
  return {
    ...n,
    menu_type: t,
    path,
    is_hidden: typeof n.is_hidden === 'boolean' ? n.is_hidden : metaHidden ?? hiddenByDynamic ?? false,
  }
}

/* ------------------------- 规范化（不限层级） -------------------------- */
/**
 * - 有 children => 目录（menu），自动补 redirect（优先显式 redirect 其后找第一个可跳转子路径）
 * - 无 children => 叶子（page/link/iframe/button），做基本清洗
 */
export function normalizeAnyDepth(nodes: MenuSeed[] | undefined): MenuSeed[] {
  if (!nodes?.length) return []
  const out: MenuSeed[] = []
  for (const raw of nodes) {
    const children = Array.isArray(raw.children) ? raw.children : []
    if (children.length) {
      const normalizedChildren = normalizeAnyDepth(children)
      out.push({
        ...asDir(raw),
        path: ensureAbsPath(raw.path),
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

/** 扁平列表（带 level/parentName），DFS 展开 */
export function toFlatWithLevel(tree: MenuSeed[]) {
  const out: Array<MenuSeed & { level: number; parentName?: string | null }> = []
  const dfs = (nodes: MenuSeed[], level: number, parentName: string | null) => {
    for (const n of nodes) {
      const { children, ...self } = n
      out.push({ ...(self as any), level, parentName })
      if (children?.length) dfs(children, level + 1, n.name)
    }
  }
  dfs(tree, 1, null)
  return out
}

/** 可选：导出冻结版本，避免运行时被篡改 */
export function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === 'object') {
    Object.freeze(obj as any)
    for (const k of Object.keys(obj as any)) {
      // @ts-ignore
      deepFreeze((obj as any)[k])
    }
  }
  return obj
}
