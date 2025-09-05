// hooks/useRolePermissions.ts
import { useCallback, useMemo, useState } from 'react'
import { App } from 'antd'
import { roleService } from '../services/roles'
import { isSuccess, getMsg } from '../utils/apiResult'
import { ensureArray } from '../utils/normalizers'
import { toTreeData } from '../utils/tree'
import type { MenuItem, Role } from '../types'
import type { DataNode } from 'antd/es/tree'

export function useRolePermissions() {
  const { message } = App.useApp()
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [role, setRole] = useState<Role | null>(null)
  const [open, setOpen] = useState(false)

  const loadMenus = useCallback(async () => {
    const r = await roleService.menus()
    if (!isSuccess(r)) return message.error(getMsg(r, '加载菜单失败'))
    setMenus(ensureArray<MenuItem>(r.data, []))
  }, [message])

  const loadRoleMenus = useCallback(
    async (roleId: number) => {
      const r = await roleService.roleMenus(roleId)
      if (!isSuccess(r)) return message.error(getMsg(r, '加载角色权限失败'))
      setSelected(ensureArray<{ id: number }>(r.data, []).map(i => i.id))
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
    if (!isSuccess(r)) return message.error(getMsg(r, '权限设置失败'))
    message.success('权限设置成功')
    setOpen(false)
  }

  const treeData: DataNode[] = useMemo(() => toTreeData(menus), [menus])

  return { role, open, setOpen, selected, setSelected, treeData, openFor, save }
}
