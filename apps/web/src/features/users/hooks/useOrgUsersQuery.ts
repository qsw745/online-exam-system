// features/users/hooks/useOrgUsersQuery.ts
import { useEffect, useState } from 'react'
import { orgsService } from '../services/orgs.service'
import { useDebounced } from './useDebounced'
import { normalizeStatus, pickDisplayRole } from '../utils/apiResult'

export function useOrgUsersQuery(selectedOrgId?: number | null) {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [role, setRole] = useState('')
  const [includeChildren, setIncludeChildren] = useState(true)
  const [keyword, setKeyword] = useState('')
  const debounced = useDebounced(keyword, 300)

  useEffect(() => {
    ;(async () => {
      if (!selectedOrgId) {
        setRows([])
        setTotal(0)
        return
      }
      setLoading(true)
      try {
        const d = await orgsService.orgUsers({
          orgId: selectedOrgId,
          page,
          limit,
          search: debounced || undefined,
          role: role || undefined,
          include_children: includeChildren ? 1 : 0,
        })
        const raw = Array.isArray(d?.items) ? d.items : Array.isArray(d?.users) ? d.users : []
        const mapped = raw.map((x: any) => ({
          id: x.id,
          email: x.email ?? '',
          role: pickDisplayRole(x.role_codes),
          nickname: x.nickname ?? x.username ?? '',
          school: x.school ?? '',
          class_name: x.class_name ?? '',
          experience_points: x.experience_points ?? 0,
          level: x.level ?? 1,
          status: normalizeStatus(x),
          created_at: x.created_at,
          updated_at: x.updated_at,
          org_id: x.org_id ?? null,
          org_name: x.org_name ?? null,
        }))
        setRows(mapped)
        setTotal(Number(d?.total || mapped.length || 0))
      } finally {
        setLoading(false)
      }
    })()
  }, [selectedOrgId, page, limit, role, includeChildren, debounced])

  return {
    loading,
    rows,
    total,
    page,
    limit,
    setPage,
    setLimit,
    role,
    setRole,
    includeChildren,
    setIncludeChildren,
    keyword,
    setKeyword,
  }
}
