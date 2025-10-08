// apps/web/src/features/users/hooks/useOrgUsersQuery.ts
import { useCallback, useEffect, useRef, useState } from 'react'
import { type ApiResult, isSuccess, getErr } from '@/shared/api/core/types'
import { usersApi } from '@/shared/api/endpoints/users'
import { orgsApi } from '@/shared/api/endpoints/orgs'

export function useOrgUsersQuery(orgId: number | null) {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [role, setRole] = useState<string | undefined>(undefined)
  const [includeChildren, setIncludeChildren] = useState(false)

  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  // 记录上一次 orgId，用于在切换机构时自动重置页码
  const prevOrgIdRef = useRef<number | null>(null)

  /** 仅用于处理仍返回 ApiResult 的旧接口（如 getById/update/resetPassword 等） */
  function unwrap<T>(r: ApiResult<T>, fallbackMsg: string): T {
    if (isSuccess<T>(r)) return r.data
    throw new Error(getErr(r, fallbackMsg))
  }

  const fetchList = useCallback(async () => {
    // 🛑 关键修复：未选择机构时，直接跳过，不请求 /users
    if (orgId == null) {
      setRows([])
      setTotal(0)
      return
    }

    setLoading(true)
    try {
      // ✅ 只请求按机构的接口
      const data = await usersApi.list({
        page,
        limit,
        search: keyword || undefined,
        role: role || undefined,
        orgId, // 有 orgId 时 usersApi.list 内部只会请求 /orgs/:id/users
        include_children: includeChildren || undefined,
      })

      setRows(Array.isArray(data.users) ? data.users : [])
      setTotal(Number(data.total) || 0)
    } catch (e) {
      // 出错也清空一下，避免保留旧数据
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [orgId, page, limit, keyword, role, includeChildren])

  useEffect(() => {
    // 机构切换时，重置页码到 1，避免新机构下页码越界
    if (prevOrgIdRef.current !== orgId) {
      setPage(1)
      prevOrgIdRef.current = orgId
    }
  }, [orgId])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  // —— 旧风格 ApiResult 的接口，做一次解包 —— //
  const getUserDetail = async (id: number | string) => {
    const r = await usersApi.getById(Number(id))
    return unwrap<any>(r, '加载用户详情失败')
  }

  const update = async (id: number | string, patch: any) => {
    const r = await usersApi.update(id, patch)
    return unwrap<any>(r, '更新用户失败')
  }

  // 返回新密码字符串（如果后端有返回）
  // 返回 true/新密码字符串（后端也可返回，但这里不依赖）
  const resetPassword = async (id: number | string, newPwd?: string | null) => {
    const r = await usersApi.resetPassword(id, newPwd ?? undefined)
    // 兼容旧 ApiResult：有 data.password 就返回；否则返回 null/true
    const data = unwrap<any>(r, '重置密码失败') ?? {}
    return data.password ?? true
  }

  const toggleStatus = async (id: number | string, status: 'active' | 'disabled') => {
    const r = await usersApi.updateStatus(id, status)
    return unwrap<any>(r, '更新状态失败')
  }

  const unbind = async (orgIdArg: number, userId: number | string) => {
    return orgsApi.removeUser(orgIdArg, Number(userId))
  }

  const bind = async (orgIdArg: number, userId: number | string) => {
    return orgsApi.addUsers(orgIdArg, [Number(userId)])
  }

  const deleteUser = async (id: number | string) => {
    const r = await usersApi.delete(id)
    return unwrap<any>(r, '删除失败')
  }

  return {
    rows,
    total,
    loading,
    page,
    setPage,
    limit,
    setLimit,
    keyword,
    setKeyword,
    role,
    setRole,
    includeChildren,
    setIncludeChildren,
    refetch: fetchList,
    getUserDetail,
    update,
    resetPassword,
    toggleStatus,
    unbind,
    bind,
    deleteUser,
  }
}

export default useOrgUsersQuery
