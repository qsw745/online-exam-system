// apps/web/src/features/roles/hooks/useRoleMembers.ts
import { App } from 'antd'
import { useCallback, useState } from 'react'
import { http } from '@/shared/api/http'
import type { ApiResult } from '@/shared/api/core/types'
import { rolesApi, type Role as ApiRole, type UserBrief as ApiUser, type RoleOrg } from '@/shared/api/endpoints/roles'

// ===== 类型定义（兼容原组件的使用）=====
export type Role = { id: number; name: string }
export type User = ApiUser & { status?: string }
export type RoleUser = User

// 用户列表（用于“添加成员”选择器）的简单封装；如果你有独立的 usersApi，可替换为 import
const usersApi = {
  list(params?: { limit?: number }) {
    // 期望后端返回：{ success, data: { users: User[] } } 或 { success, data: User[] }
    return http.get<ApiResult<{ users: User[] } | User[]>>('/users', { params })
  },
}

// ===== 工具函数 =====
const ensureArray = <T>(input: any, fallback: T[] = []): T[] => {
  if (Array.isArray(input)) return input as T[]
  if (input == null) return fallback
  const maybe = (input.items ?? input.data ?? input.list ?? input.rows ?? input.users) as T[] | undefined
  return Array.isArray(maybe) ? maybe : fallback
}
const unwrap = <T>(r: ApiResult<T>): T => (r && typeof r === 'object' && 'data' in r ? (r as any).data : (r as any))
const isOk = (r: any) => r?.success !== false && !r?.error
const getMsg = (r: any, fallback: string) => r?.message || r?.error || fallback

// ===== 角色成员/机构相关服务（统一走封装好的 rolesApi）=====
const roleService = {
  async roleUsers(roleId: number) {
    const r = await rolesApi.getRoleUsers(roleId)
    return unwrap(r) // User[]
  },
  async removeUser(roleId: number, userId: number) {
    const r = await rolesApi.removeUserFromRole(roleId, userId)
    return r
  },
  async addUsers(roleId: number, userIds: number[]) {
    const r = await rolesApi.addUsersToRole(roleId, userIds)
    return r
  },
  async roleOrgs(roleId: number) {
    const r = await rolesApi.getRoleOrgs(roleId)
    return unwrap(r) as RoleOrg[]
  },
  async allUsers() {
    const r = await usersApi.list({ limit: 1000 })
    const data = unwrap(r)
    // 兼容两种 data 结构：{ users: [] } 或 []
    const list = Array.isArray((data as any)?.users) ? (data as any).users : (data as any)
    return ensureArray<User>(list, [])
  },
}

// ===== Hook =====
export function useRoleMembers() {
  const { message } = App.useApp()

  // 弹窗/上下文
  const [role, setRole] = useState<Role | null>(null)
  const [open, setOpen] = useState(false)

  // 用户成员
  const [loading, setLoading] = useState(false)
  const [members, setMembers] = useState<RoleUser[]>([])

  // 机构（新增）
  const [orgsLoading, setOrgsLoading] = useState(false)
  const [roleOrgs, setRoleOrgs] = useState<RoleOrg[]>([])

  // 选人弹窗
  const [userOpen, setUserOpen] = useState(false)
  const [candidateUsers, setCandidateUsers] = useState<User[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [userLoading, setUserLoading] = useState(false)

  // 加载成员（用户）
  const loadMembers = useCallback(
    async (roleId: number): Promise<void> => {
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

  // 加载机构（新增）
  const loadOrgs = useCallback(
    async (roleId: number): Promise<void> => {
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

  // 打开当前角色的成员&机构
  const openFor = async (r: Role | ApiRole): Promise<void> => {
    const rid = Number((r as any).id)
    setRole({ id: rid, name: (r as any).name })
    await Promise.all([loadMembers(rid), loadOrgs(rid)])
    setOpen(true)
  }

  // 从角色移除用户
  const remove = async (userId: number): Promise<void> => {
    if (!role) return
    const r = await roleService.removeUser(role.id, userId)
    if (!isOk(r)) {
      message.error(getMsg(r, '移除用户失败'))
      return
    }
    await loadMembers(role.id)
  }

  // 打开“添加成员”选择器
  const openUserSelect = async (): Promise<void> => {
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
  const addUsers = async (): Promise<void> => {
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

  return {
    // 成员弹窗
    role,
    open,
    setOpen,

    // 用户成员
    members,
    loading,
    openFor,
    remove,

    // 机构（新增）
    roleOrgs,
    orgsLoading,
    reloadOrgs: async () => role && (await loadOrgs(role.id)),

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
