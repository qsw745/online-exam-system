// features/roles/hooks/useRoles.ts
import { useCallback, useState } from 'react'
import { App } from 'antd'
import { api } from '@/shared/api/http'

// ===== 轻量类型 =====
export type Role = {
  id: number
  name: string
  code?: string
  description?: string | null
  status?: string
}

// ===== 轻量工具 =====
const ensureArray = <T>(input: any, fallback: T[] = []): T[] => {
  if (Array.isArray(input)) return input as T[]
  if (input == null) return fallback
  const maybe = (input.items ?? input.data ?? input.list ?? input.rows) as T[] | undefined
  return Array.isArray(maybe) ? maybe : fallback
}
const pickTotal = (input: any, fallback = 0): number => {
  if (!input) return fallback
  return (
    Number(input?.pagination?.total) ??
    Number(input?.total) ??
    Number(input?.count) ??
    Number(input?.length) ??
    fallback
  )
}
const isOk = (r: any) => r?.success !== false && !r?.error
const getMsg = (r: any, fallback: string) => r?.message || r?.error || fallback
const unwrap = (r: any) => (r && typeof r === 'object' && 'data' in r ? (r as any).data : r)

// ===== API =====
const roleService = {
  async list(params: { page?: number; limit?: number; keyword?: string }) {
    const r = await api.get<any>('/roles', { params })
    return unwrap(r)
  },
  async create(payload: Partial<Role>) {
    const r = await api.post<any>('/roles', payload)
    return unwrap(r)
  },
  async update(id: number, payload: Partial<Role>) {
    const r = await api.put<any>(`/roles/${id}`, payload)
    return unwrap(r)
  },
  async remove(id: number) {
    const r = await api.delete<any>(`/roles/${id}`)
    return unwrap(r)
  },
}

export function useRoles() {
  const { message } = App.useApp()
  const [list, setList] = useState<Role[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [keyword, setKeyword] = useState('')

  const load = useCallback(
    async (p = page, s = pageSize, k = keyword) => {
      try {
        setLoading(true)
        const resp = await roleService.list({ page: p, limit: s, keyword: k || undefined })
        if (!isOk(resp)) throw new Error(getMsg(resp, '加载角色失败'))
        const arr = ensureArray<Role>(resp, [])
        setList(arr)
        setTotal(arr.length ? pickTotal(resp, arr.length) : pickTotal(resp, 0))
        setPage(p)
        setPageSize(s)
      } catch (e: any) {
        console.error(e)
        message.error(e?.message || '加载角色失败')
        setList([])
        setTotal(0)
      } finally {
        setLoading(false)
      }
    },
    [page, pageSize, keyword, message]
  )

  const create = async (payload: Partial<Role>) => {
    const r = await roleService.create(payload)
    if (!isOk(r)) throw new Error(getMsg(r, '角色创建失败'))
    await load(1, pageSize, keyword)
  }
  const update = async (id: number, payload: Partial<Role>) => {
    const r = await roleService.update(id, payload)
    if (!isOk(r)) throw new Error(getMsg(r, '角色更新失败'))
    await load(page, pageSize, keyword)
  }
  const remove = async (id: number) => {
    const r = await roleService.remove(id)
    if (!isOk(r)) throw new Error(getMsg(r, '删除失败'))
    await load(page, pageSize, keyword)
  }

  return {
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
