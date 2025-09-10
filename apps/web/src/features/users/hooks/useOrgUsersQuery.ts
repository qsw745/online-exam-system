// src/features/users/hooks/useOrgUsersQuery.ts
import { useCallback, useEffect, useState } from 'react'
import { isSuccess, getErr, type ApiResult } from '@/shared/api/http'
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

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        page,
        limit,
        search: keyword || undefined,
        role: role || undefined,
        orgId: orgId || undefined,
        include_children: includeChildren || undefined,
      }
      const r = (await (usersApi as any).list?.(params)) as ApiResult<any>
      if (!isSuccess(r)) throw new Error(getErr(r, '加载用户失败'))

      const payload = r.data as any
      const list = payload?.items ?? payload?.list ?? payload?.users ?? payload?.data ?? payload ?? []
      const t = payload?.total ?? payload?.count ?? payload?.pagination?.total ?? list.length

      setRows(Array.isArray(list) ? list : [])
      setTotal(Number(t) || 0)
    } finally {
      setLoading(false)
    }
  }, [orgId, page, limit, keyword, role, includeChildren])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  // ✅ 解包为纯用户对象：兼容 {success,data:{...}} / {data:{...}} / {...}
  const getUserDetail = async (id: number | string) => {
    const r = await usersApi.getById(Number(id))
    if (!isSuccess(r)) throw new Error(getErr(r, '加载用户详情失败'))
    const d: any = r.data
    return d?.data ?? d?.user ?? d?.record ?? d // ← 返回最里层
  }

  const update = (id: number | string, patch: any) =>
    usersApi.update(id, patch).then(r => {
      if (!isSuccess(r)) throw new Error(getErr(r, '更新用户失败'))
      return r
    })

  // 返回新密码字符串（如果后端有返回）
  const resetPassword = async (id: number | string) => {
    const r = await usersApi.resetPassword(id)
    if (!isSuccess(r)) throw new Error(getErr(r, '重置密码失败'))
    const d: any = r?.data ?? {}
    return d.password ?? d.newPassword ?? d.tempPassword ?? d.defaultPassword ?? null
  }

  const toggleStatus = (id: number | string, status: 'active' | 'disabled') =>
    usersApi.updateStatus(id, status).then(r => {
      if (!isSuccess(r)) throw new Error(getErr(r, '更新状态失败'))
      return r
    })

  const unbind = (orgId: number, userId: number | string) =>
    orgsApi.removeUser(orgId, Number(userId)).then(r => {
      if (!isSuccess(r)) throw new Error(getErr(r, '从机构移除失败'))
      return r
    })

  const bind = (orgId: number, userId: number | string) =>
    orgsApi.addUser(orgId, Number(userId)).then(r => {
      if (!isSuccess(r)) throw new Error(getErr(r, '绑定失败'))
      return r
    })

  const deleteUser = (id: number | string) =>
    usersApi.delete(id).then(r => {
      if (!isSuccess(r)) throw new Error(getErr(r, '删除失败'))
      return r
    })

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
