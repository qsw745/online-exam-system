import type { ApiResult } from '@/shared/api/core/types'
import { rolesApi, type Role as ApiRole, type UserBrief as ApiUser, type RoleOrg } from '@/shared/api/endpoints/roles'
import { api } from '@/shared/api/http'
import { App } from 'antd'
import { useCallback, useState } from 'react'

export type Role = { id: number; name: string }
export type User = ApiUser & { status?: string }
export type RoleUser = User

const usersApi = {
  list(params?: { limit?: number }) {
    return api.get<ApiResult<{ users: User[] } | User[]>>('/users', { params })
  },
}

// —— 工具 —— //
const ensureArray = <T>(input: any, fallback: T[] = []): T[] => {
  if (Array.isArray(input)) return input as T[]
  if (input == null) return fallback
  const maybe = (input.items ?? input.data ?? input.list ?? input.rows ?? input.users) as T[] | undefined
  return Array.isArray(maybe) ? maybe : fallback
}
const unwrap = <T>(r: ApiResult<T> | any): T =>
  r && typeof r === 'object' && 'success' in r ? (r.success ? (r.data as T) : ([] as any)) : (r as T)
const isOk = (r: any) => r?.success !== false && !r?.error
const getMsg = (r: any, fallback: string) => r?.message || r?.error || fallback

// —— 服务 —— //
const roleService = {
  async roleUsers(roleId: number) {
    const r = await rolesApi.getRoleUsers(roleId)
    return unwrap(r) as RoleUser[]
  },
  async removeUser(roleId: number, userId: number) {
    return rolesApi.removeUserFromRole(roleId, userId)
  },
  async addUsers(roleId: number, userIds: number[]) {
    return rolesApi.addUsersToRole(roleId, userIds)
  },
  async roleOrgs(roleId: number) {
    const r = await rolesApi.getRoleOrgs(roleId)
    return unwrap(r) as RoleOrg[]
  },
  async addOrgs(roleId: number, orgIds: number[]) {
    return rolesApi.addRoleOrgs(roleId, orgIds) // ✅ 新增：调用后端 POST /roles/:id/orgs
  },
  async removeOrg(roleId: number, orgId: number) {
    return rolesApi.removeRoleOrg(roleId, orgId)
  },
  async allUsers() {
    const r = await usersApi.list({ limit: 1000 })
    const data = unwrap(r)
    const list = Array.isArray((data as any)?.users) ? (data as any).users : (data as any)
    return ensureArray<User>(list, [])
  },
}

// —— Hook —— //
export function useRoleMembers() {
  const { message } = App.useApp()

  const [role, setRole] = useState<Role | null>(null)
  const [open, setOpen] = useState(false)

  const [loading, setLoading] = useState(false)
  const [members, setMembers] = useState<RoleUser[]>([])

  const [orgsLoading, setOrgsLoading] = useState(false)
  const [roleOrgs, setRoleOrgs] = useState<RoleOrg[]>([])

  const [userOpen, setUserOpen] = useState(false)
  const [candidateUsers, setCandidateUsers] = useState<User[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [userLoading, setUserLoading] = useState(false)

  // 用户
  const loadMembers = useCallback(
    async (roleId: number) => {
      setLoading(true)
      try {
        const arr = await roleService.roleUsers(roleId)
        setMembers(ensureArray<RoleUser>(arr, []))
      } catch (e: any) {
        console.error(e)
        message.error(e?.message || '加载角色用户失败')
      } finally {
        setLoading(false)
      }
    },
    [message]
  )

  // 机构
  const loadOrgs = useCallback(
    async (roleId: number) => {
      setOrgsLoading(true)
      try {
        const arr = await roleService.roleOrgs(roleId)
        setRoleOrgs(ensureArray<RoleOrg>(arr, []))
      } catch (e: any) {
        console.error(e)
        message.error(e?.message || '加载角色机构失败')
      } finally {
        setOrgsLoading(false)
      }
    },
    [message]
  )

  // 打开
  const openFor = async (r: Role | ApiRole) => {
    const rid = Number((r as any).id)
    setRole({ id: rid, name: (r as any).name })
    await Promise.all([loadMembers(rid), loadOrgs(rid)])
    setOpen(true)
  }

  // 从角色移除用户
  const remove = async (userId: number) => {
    if (!role) return
    const r = await roleService.removeUser(role.id, userId)
    if (!isOk(r)) {
      message.error(getMsg(r, '移除用户失败'))
      return
    }
    await loadMembers(role.id)
  }

  // 从角色移除机构
  const removeOrg = async (orgId: number) => {
    if (!role) return
    const r = await roleService.removeOrg(role.id, orgId)
    if (!isOk(r)) {
      message.error(getMsg(r, '移除机构失败'))
      return
    }
    await loadOrgs(role.id)
  }

  // 选人弹窗
  const openUserSelect = async () => {
    if (!role) return
    setSelectedIds([])
    setUserLoading(true)
    try {
      const allList = await roleService.allUsers()
      const cur = await roleService.roleUsers(role.id)
      const curIds = new Set(ensureArray<RoleUser>(cur, []).map(u => u.id))
      setCandidateUsers(allList.filter(u => !curIds.has(u.id) && (u.status ?? 'active') === 'active'))
      setUserOpen(true)
    } catch (e: any) {
      console.error(e)
      message.error(e?.message || '加载用户失败')
    } finally {
      setUserLoading(false)
    }
  }

  // 提交添加成员
  const addUsers = async () => {
    if (!role || selectedIds.length === 0) return
    const r = await roleService.addUsers(role.id, selectedIds)
    if (!isOk(r)) {
      message.error(getMsg(r, '添加用户失败'))
      return
    }
    setUserOpen(false)
    setSelectedIds([])
    await loadMembers(role.id)
  }

  // ✅ 新增：添加机构（供 RoleManagementPage 调用）
  async function addOrgs(orgIds: number[], includeChildren = false) {
    if (!role?.id) return
    let total = 0
    for (const oid of orgIds) {
      const ret = await rolesApi.addUsersToRoleByOrg(role.id, oid, { include_children: includeChildren })
      const data = unwrap<{ added?: number }>(ret)
      total += Number(data?.added ?? 0)
    }
    message.success(`已从所选机构添加 ${total} 人`)
    await loadMembers(role.id) // ✅ 刷新成员列表
  }

  return {
    // 弹窗
    role,
    open,
    setOpen,
    // 用户
    members,
    loading,
    openFor,
    remove,
    addUsers,
    // 机构
    roleOrgs,
    orgsLoading,
    removeOrg,
    addOrgs, // ✅ 暴露给父组件
    reloadOrgs: async () => role && (await loadOrgs(role.id)),
    // 选人
    userOpen,
    setUserOpen,
    userLoading,
    candidateUsers,
    selectedIds,
    setSelectedIds,
    openUserSelect,
  }
}
