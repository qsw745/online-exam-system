// hooks/useRoleMembers.ts
import { useCallback, useState } from 'react'
import { App } from 'antd'
import { roleService } from '../services/roles'
import { isSuccess, getMsg } from '../utils/apiResult'
import { ensureArray } from '../utils/normalizers'
import type { RoleUser, User, Role } from '../types'

export function useRoleMembers() {
  const { message, modal } = App.useApp()
  const [role, setRole] = useState<Role | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [members, setMembers] = useState<RoleUser[]>([])

  const [userOpen, setUserOpen] = useState(false)
  const [candidateUsers, setCandidateUsers] = useState<User[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [userLoading, setUserLoading] = useState(false)

  const loadMembers = useCallback(
    async (roleId: number) => {
      setLoading(true)
      try {
        const r = await roleService.roleUsers(roleId)
        if (!isSuccess(r)) throw new Error(getMsg(r, '加载角色用户失败'))
        setMembers(ensureArray<RoleUser>(r.data, []))
      } catch (e: any) {
        message.error(e.message)
      } finally {
        setLoading(false)
      }
    },
    [message]
  )

  const openFor = async (r: Role) => {
    setRole(r)
    await loadMembers(r.id)
    setOpen(true)
  }

  const remove = async (userId: number) => {
    if (!role) return
    const r = await roleService.removeUser(role.id, userId)
    if (!isSuccess(r)) return message.error(getMsg(r, '移除用户失败'))
    await loadMembers(role.id)
  }

  const openUserSelect = async () => {
    if (!role) return
    setSelectedIds([])
    setUserLoading(true)
    try {
      const all = await roleService.users()
      const cur = await roleService.roleUsers(role.id)
      if (!isSuccess(all)) throw new Error(getMsg(all, '加载用户失败'))
      const allList = ensureArray<User>(all.data, [])
      const curIds = new Set(ensureArray<RoleUser>(isSuccess(cur) ? cur.data : [], []).map(u => u.id))
      setCandidateUsers(allList.filter(u => !curIds.has(u.id) && u.status === 'active'))
      setUserOpen(true)
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setUserLoading(false)
    }
  }

  const addUsers = async () => {
    if (!role || selectedIds.length === 0) return
    const r = await roleService.addUsers(role.id, selectedIds)
    if (!isSuccess(r)) return message.error(getMsg(r, '添加用户失败'))
    setUserOpen(false)
    setSelectedIds([])
    await loadMembers(role.id)
  }

  return {
    // 成员弹窗
    role,
    open,
    setOpen,
    members,
    loading,
    openFor,
    remove,
    // 选人弹窗
    userOpen,
    setUserOpen,
    userLoading,
    candidateUsers,
    selectedIds,
    setSelectedIds,
    openUserSelect,
    addUsers,
  }
}
