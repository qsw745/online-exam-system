// src/features/users/hooks/useOrgUsersQuery.ts
import { useCallback, useEffect, useState } from 'react'
import { api, isSuccess, getErr, type ApiResult } from '@/shared/api/http'

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
    setLoading(true)
    try {
      const params: any = {
        page,
        limit,
        keyword: keyword || undefined,
        role: role || undefined,
        include_children: includeChildren || undefined,
      }

      let r: ApiResult<any> | null = null

      if (orgId) {
        // ① 优先 /orgs/:id/users（如果后端支持）
        // try {
        //   r = await api.get(`/orgs/${orgId}/users`, { params })
        // } catch {
        //   r = null
        // }
        // ② 其次 /orgusers?org_id=xxx（当前后端实际挂载）
        if (!r) {
          try {
            r = await api.get('/orgusers', { params: { ...params, orgId: orgId } })
          } catch {
            r = null
          }
        }
        // ③ 兜底 /users?org_id=xxx（历史实现）
        if (!r) {
          r = await api.get('/users', { params: { ...params, orgId: orgId } })
        }
      } else {
        // 没选机构：试图加载“全量用户”（方便一打开页面就有数据）
        r = await api.get('/users', { params })
      }

      if (!isSuccess(r)) throw new Error(getErr(r, '加载用户失败'))

      const payload = r.data as any
      const list = payload?.items ?? payload?.list ?? payload?.users ?? payload ?? []
      const t = payload?.total ?? payload?.count ?? list.length
      setRows(Array.isArray(list) ? list : [])
      setTotal(Number(t) || 0)
    } finally {
      setLoading(false)
    }
  }, [orgId, page, limit, keyword, role, includeChildren])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  // 行操作
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
