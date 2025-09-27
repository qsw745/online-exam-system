import { rolesApi } from '@/shared/api/endpoints/roles'
import { App } from 'antd'
import type { DataNode } from 'antd/es/tree'
import { useCallback, useMemo, useState } from 'react'

export type MenuItem = { id: number; title: string; name?: string; parent_id?: number | null; children?: MenuItem[] }
export type Role = { id: number; name: string }
const ensureArray = <T>(input: any, fallback: T[] = []): T[] => (Array.isArray(input) ? input : fallback)
const isOk = (r: any) => r?.success !== false && !r?.error
const getMsg = (r: any, fallback: string) => r?.message || r?.error || fallback
const unwrap = (r: any) => (r && typeof r === 'object' && 'data' in r ? (r as any).data : r)

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
  const [orgId, setOrgId] = useState<number | undefined>(undefined) // ⭐

  const loadMenus = useCallback(
    async (roleId: number, _orgId?: number) => {
      const resp = await rolesApi.getRoleEffectiveMenus(roleId, _orgId)
      if (!isOk(resp)) return message.error(getMsg(resp, '加载菜单失败'))
      const data = unwrap(resp) as any
      const arr = ensureArray<MenuItem>(data?.menus ?? data, [])
      setMenus(arr)
    },
    [message]
  )

  const loadRoleMenus = useCallback(
    async (roleId: number) => {
      const r = await rolesApi.getRoleMenus(roleId)
      if (!isOk(r)) return message.error(getMsg(r, '加载角色权限失败'))
      const arr = ensureArray<any>(unwrap(r), [])
      setSelected(arr.map((i: any) => Number(i?.id ?? i?.menu_id ?? i)).filter((n: number) => Number.isFinite(n)))
    },
    [message]
  )

  const openFor = async (r: Role, boundOrgId?: number) => {
    setRole(r)
    setOrgId(boundOrgId)
    await loadMenus(r.id, boundOrgId)
    await loadRoleMenus(r.id)
    setOpen(true)
  }

  const save = async () => {
    if (!role) return
    const ids = Array.from(new Set(selected.map(Number).filter(n => Number.isFinite(n)))) as number[]
    const resp = await rolesApi.setRoleMenus(role.id, ids)
    if (!isOk(resp)) return message.error(getMsg(resp, '权限设置失败'))
    message.success('权限设置成功')
    setOpen(false)
  }

  const treeData: DataNode[] = useMemo(() => toTreeData(menus), [menus])
  return { role, open, setOpen, selected, setSelected, treeData, openFor, save, orgId }
}
