import { useCallback, useEffect, useState } from 'react'
import { api, isSuccess, getErr, type ApiResult } from '@shared/api/http'

export function useOrgUsersQuery(orgId: number | null) {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [role, setRole] = useState<string | undefined>(undefined)
  const [includeChildren, setIncludeChildren] = useState(true)

  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const fetchList = useCallback(async () => {
    if (!orgId) {
      setRows([])
      setTotal(0)
      return
    }
    setLoading(true)
    try {
      // 优先走 org 维度列表（按你的后端实际调整）
      const params: any = {
        page,
        limit,
        keyword: keyword || undefined,
        role: role || undefined,
        include_children: includeChildren || undefined,
      }
      let r: ApiResult<any>
      try {
        r = await api.get(`/orgs/${orgId}/users`, { params })
      } catch {
        // 兼容回退：如果没有 org 专属路由，就用 /users?org_id=xxx
        r = await api.get('/users', { params: { ...params, org_id: orgId } })
      }
      if (!isSuccess(r)) throw new Error(getErr(r, '加载用户失败'))

      // 兼容 data 结构
      const payload = r.data as any
      const list = payload?.items ?? payload?.list ?? payload?.users ?? payload ?? []
      const t = payload?.total ?? payload?.count ?? list.length
      setRows(list)
      setTotal(t)
    } finally {
      setLoading(false)
    }
  }, [orgId, page, limit, keyword, role, includeChildren])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  // —— 行操作（统一由 hook 暴露给页面）——
  const resetPassword = (id: number | string) => api.put(`/users/${id}/reset-password`).then(r => r)

  const toggleStatus = (id: number | string, status: 'active' | 'disabled') =>
    api.put(`/users/${id}/status`, { status }).then(r => r)

  const unbind = (orgId: number, userId: number | string) => api.delete(`/orgs/${orgId}/users/${userId}`).then(r => r)

  const deleteUser = (id: number | string) => api.delete(`/users/${id}`).then(r => r)

  return {
    // data
    rows,
    total,
    loading,
    // paging & filters
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
    // actions
    refetch: fetchList,
    resetPassword,
    toggleStatus,
    unbind,
    deleteUser,
  }
}

export default useOrgUsersQuery
