// features/roles/hooks/useRoleMembers.ts
import { useCallback, useState } from 'react'
import { App } from 'antd'
import { api } from '@shared/api/http'

// ===== 轻量类型 =====
export type Role = { id: number; name: string }
export type User = { id: number; username: string; email?: string; status?: string }
export type RoleUser = User

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

// ===== API =====
const roleService = {
  async roleUsers(roleId: number) {
    const r = await api.get<any>(`/roles/${roleId}/users`)
    return unwrap(r)
  },
  async removeUser(roleId: number, userId: number) {
    const r = await api.delete<any>(`/roles/${roleId}/users/${userId}`)
    return unwrap(r)
  },
  async users() {
    const r = await api.get<any>('/users', { params: { limit: 1000 } })
    return unwrap(r)
  },
  async addUsers(roleId: number, userIds: number[]) {
    const r = await api.post<any>(`/roles/${roleId}/users`, { user_ids: userIds })
    return unwrap(r)
  },
}

export function useRoleMembers() {
  const { message } = App.useApp()
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
        if (!isOk(r)) throw new Error(getMsg(r, '加载角色用户失败'))
        setMembers(ensureArray<RoleUser>(r, []))
      } catch (e: any) {
        message.error(e?.message || '加载角色用户失败')
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
    if (!isOk(r)) return message.error(getMsg(r, '移除用户失败'))
    await loadMembers(role.id)
  }

  const openUserSelect = async () => {
    if (!role) return
    setSelectedIds([])
    setUserLoading(true)
    try {
      const all = await roleService.users()
      const cur = await roleService.roleUsers(role.id)
      if (!isOk(all)) throw new Error(getMsg(all, '加载用户失败'))

      const allList = ensureArray<User>(all, [])
      const curIds = new Set(ensureArray<RoleUser>(isOk(cur) ? cur : [], []).map((u: RoleUser) => u.id))
      setCandidateUsers(allList.filter((u: User) => !curIds.has(u.id) && (u.status ?? 'active') === 'active'))
      setUserOpen(true)
    } catch (e: any) {
      message.error(e?.message || '加载用户失败')
    } finally {
      setUserLoading(false)
    }
  }

  const addUsers = async () => {
    if (!role || selectedIds.length === 0) return
    const r = await roleService.addUsers(role.id, selectedIds)
    if (!isOk(r)) return message.error(getMsg(r, '添加用户失败'))
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
