// src/features/roles/hooks/useRolePermissions.ts
import { rolesApi } from '@/shared/api/endpoints/roles'
import { App } from 'antd'
import type { DataNode } from 'antd/es/tree'
import { useCallback, useMemo, useState } from 'react'

export type MenuItem = { id: number; title: string; name?: string; parent_id?: number | null; children?: MenuItem[] }
export type Role = { id: number; name: string }

const ensureArray = <T>(v: any, d: T[] = []): T[] => (Array.isArray(v) ? v : d)
const isOk = (r: any) => r?.success !== false && !r?.error
const getMsg = (r: any, fb: string) => r?.message || r?.error || fb
const unwrap = (r: any) => (r && typeof r === 'object' && 'data' in r ? (r as any).data : r)

function toTreeData(items: MenuItem[]): DataNode[] {
  const map = new Map<number, MenuItem>()
  items.forEach(i => map.set(i.id, { ...i, children: [] }))
  const roots: MenuItem[] = []
  items.forEach(i => {
    const n = map.get(i.id)!
    const pid = i.parent_id ?? null
    if (pid == null || !map.has(pid)) roots.push(n)
    else map.get(pid)!.children!.push(n)
  })
  const walk = (list: MenuItem[]): DataNode[] =>
    list
      .sort((a, b) => (a.title || '').localeCompare(b.title || ''))
      .map(n => ({
        key: n.id,
        title: n.title || n.name || `#${n.id}`,
        children: n.children?.length ? walk(n.children) : undefined,
      }))
  return walk(roots)
}

export function useRolePermissions() {
  const { message } = App.useApp()
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [role, setRole] = useState<Role | null>(null)
  const [open, setOpen] = useState(false)

  // ⭐ 一次拉取“全部菜单 + 当前角色选中”
  const loadAll = useCallback(
    async (roleId: number) => {
      const resp = await rolesApi.getRoleMenusAll(roleId)
      if (!isOk(resp)) return message.error(getMsg(resp, '加载菜单失败'))
      const data = unwrap(resp) as { menus?: any[]; selected?: number[] }
      setMenus(ensureArray<MenuItem>(data?.menus, []))
      setSelected(ensureArray<number>(data?.selected, []))
    },
    [message]
  )

  const openFor = async (r: Role) => {
    setRole(r)
    await loadAll(r.id)
    setOpen(true)
  }

  const save = async () => {
    if (!role) return
    const ids = Array.from(new Set(selected.map(Number).filter(Number.isFinite))) as number[]
    const resp = await rolesApi.setRoleMenus(role.id, ids)
    if (!isOk(resp)) return message.error(getMsg(resp, '权限设置失败'))
    message.success('权限设置成功')
    setOpen(false)
  }

  const treeData: DataNode[] = useMemo(() => toTreeData(menus), [menus])

  return { role, open, setOpen, selected, setSelected, treeData, openFor, save }
}
