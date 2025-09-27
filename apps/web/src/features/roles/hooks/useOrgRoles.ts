// apps/web/src/features/roles/hooks/useOrgRoles.ts
import { rolesApi, type Role } from '@/shared/api/endpoints/roles'
import { App } from 'antd'
import { useCallback, useState } from 'react'

const ensureArray = <T>(input: any, fallback: T[] = []): T[] => (Array.isArray(input) ? input : fallback)
const isOk = (r: any) => r?.success !== false && !r?.error
const getMsg = (r: any, fallback: string) => r?.message || r?.error || fallback
const unwrap = (r: any) => (r && typeof r === 'object' && 'data' in r ? (r as any).data : r)

export function useOrgRoles(orgId?: number | null) {
  const { message } = App.useApp()
  const [list, setList] = useState<Role[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [keyword, setKeyword] = useState('')

  const load = useCallback(
    async (p = page, s = pageSize, k = keyword) => {
      if (!orgId) {
        setList([])
        setTotal(0)
        return
      }
      setLoading(true)
      try {
        const resp = await rolesApi.listInOrg(orgId, { page: p, pageSize: s, keyword: k || undefined })
        const data = unwrap(resp) as { roles: Role[]; total: number; page: number; pageSize: number }
        setList(ensureArray<Role>(data?.roles, []))
        setTotal(Number(data?.total) || 0)
        setPage(Number(data?.page) || 1)
        setPageSize(Number(data?.pageSize) || 10)
      } catch (e: any) {
        console.error(e)
        message.error(e?.message || '加载角色失败')
        setList([])
        setTotal(0)
      } finally {
        setLoading(false)
      }
    },
    [orgId, page, pageSize, keyword, message]
  )

  const create = async (payload: Partial<Role>) => {
    if (!orgId) return
    const r = await rolesApi.createInOrg(orgId, payload as any)
    if (!isOk(r)) throw new Error(getMsg(r, '角色创建失败'))
    await load(1, pageSize, keyword)
  }
  const update = async (id: number, payload: Partial<Role>) => {
    if (!orgId) return
    const r = await rolesApi.updateInOrg(orgId, id, payload as any)
    if (!isOk(r)) throw new Error(getMsg(r, '角色更新失败'))
    await load(page, pageSize, keyword)
  }
  const remove = async (id: number) => {
    if (!orgId) return
    const r = await rolesApi.removeInOrg(orgId, id)
    if (!isOk(r)) throw new Error(getMsg(r, '删除失败'))
    const willLeft = total - 1 - (page - 1) * pageSize
    if (willLeft <= 0 && page > 1) await load(page - 1, pageSize, keyword)
    else await load(page, pageSize, keyword)
  }

  return {
    orgId,
    list,
    loading,
    page,
    pageSize,
    total,
    keyword,
    setKeyword,
    setPage,
    setPageSize,
    load,
    create,
    update,
    remove,
  }
}
