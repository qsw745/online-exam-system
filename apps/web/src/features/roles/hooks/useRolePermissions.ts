// features/roles/hooks/useRolePermissions.ts
import { useCallback, useMemo, useState } from 'react'
import { App } from 'antd'
import type { DataNode } from 'antd/es/tree'
import { api } from '@shared/api/http'

// ===== 轻量类型 =====
export type MenuItem = {
  id: number
  title: string
  name?: string
  parent_id?: number | null
  children?: MenuItem[]
}
export type Role = { id: number; name: string }

// ===== 轻量工具 =====
const ensureArray = <T>(input: any, fallback: T[] = []): T[] => {
  if (Array.isArray(input)) return input as T[]
  if (input == null) return fallback
  const maybe = (input.items ?? input.data ?? input.list ?? input.rows) as T[] | undefined
  return Array.isArray(maybe) ? maybe : fallback
}
const isOk = (r: any) => r?.success !== false && !r?.error
const getMsg = (r: any, fallback: string) => r?.message || r?.error || fallback
const unwrap = (r: any) => (r && typeof r === 'object' && 'data' in r ? (r as any).data : r)

// 扁平 -> 树
function toTreeData(items: MenuItem[]): DataNode[] {
  const map = new Map<number, MenuItem>()
  items.forEach(i => map.set(i.id, { ...i, children: [] }))

  const roots: MenuItem[] = []
  items.forEach(i => {
    const node = map.get(i.id)!
    const pid = i.parent_id ?? null
    if (pid == null || !map.has(pid)) roots.push(node)
    else map.get(pid)!.children!.push(node)
  })

  const walk = (list: MenuItem[]): DataNode[] =>
    list
      .sort((a, b) => (a.title || '').localeCompare(b.title || ''))
      .map(n => ({
        key: n.id,
        title: n.title || n.name || `#${n.id}`,
        children: n.children && n.children.length ? walk(n.children) : undefined,
      }))

  return walk(roots)
}

// ===== API =====
const roleService = {
  async menus() {
    const r = await api.get<any>('/menus')
    return unwrap(r)
  },
  async roleMenus(roleId: number) {
    const r = await api.get<any>(`/roles/${roleId}/menus`)
    return unwrap(r)
  },
  async saveRoleMenus(roleId: number, menuIds: number[]) {
    const r = await api.put<any>(`/roles/${roleId}/menus`, { menu_ids: menuIds })
    return unwrap(r)
  },
}

export function useRolePermissions() {
  const { message } = App.useApp()
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [role, setRole] = useState<Role | null>(null)
  const [open, setOpen] = useState(false)

  const loadMenus = useCallback(async () => {
    const r = await roleService.menus()
    if (!isOk(r)) return message.error(getMsg(r, '加载菜单失败'))
    setMenus(ensureArray<MenuItem>(r, []))
  }, [message])

  const loadRoleMenus = useCallback(
    async (roleId: number) => {
      const r = await roleService.roleMenus(roleId)
      if (!isOk(r)) return message.error(getMsg(r, '加载角色权限失败'))
      const arr = ensureArray<any>(r, [])
      setSelected(arr.map((i: any) => Number(i?.id ?? i?.menu_id ?? i)).filter((n: number) => !Number.isNaN(n)))
    },
    [message]
  )

  const openFor = async (r: Role) => {
    setRole(r)
    await loadMenus()
    await loadRoleMenus(r.id)
    setOpen(true)
  }

  const save = async () => {
    if (!role) return
    const r = await roleService.saveRoleMenus(role.id, selected)
    if (!isOk(r)) return message.error(getMsg(r, '权限设置失败'))
    message.success('权限设置成功')
    setOpen(false)
  }

  const treeData: DataNode[] = useMemo(() => toTreeData(menus), [menus])

  return { role, open, setOpen, selected, setSelected, treeData, openFor, save }
}
