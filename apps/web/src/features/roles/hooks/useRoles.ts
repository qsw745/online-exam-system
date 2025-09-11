import { rolesApi } from '@/shared/api/http'
import { App } from 'antd'
import { useCallback, useState } from 'react'

export type Role = {
  id: number
  name?: string
  code?: string
  description?: string | null
  status?: string
}

const ensureArray = <T>(input: any, fallback: T[] = []): T[] => {
  if (Array.isArray(input)) return input as T[]
  if (input == null) return fallback
  const maybe = (input.items ?? input.data ?? input.list ?? input.rows) as T[] | undefined
  return Array.isArray(maybe) ? maybe : fallback
}

// 把 total 抠出来并做数值兜底
const pickTotal = (input: any, fallback = 0): number => {
  const raw =
    input?.pagination?.total ??
    input?.total ??
    input?.count ??
    (Array.isArray(input) ? input.length : undefined) ??
    fallback
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}
const isOk = (r: any) => r?.success !== false && !r?.error
const getMsg = (r: any, fallback: string) => r?.message || r?.error || fallback
const unwrap = (r: any) => (r && typeof r === 'object' && 'data' in r ? (r as any).data : r)

const roleService = {
  async list(params: { page?: number; limit?: number; keyword?: string }) {
    // const r = await api.get<any>('/roles', { params })
    const r = await rolesApi.list(params)
    return unwrap(r)
  },
  async create(payload: Partial<Role>) {
    // const r = await api.post<any>('/roles', payload)
    const r = await rolesApi.create(payload)
    return unwrap(r)
  },
  async addRog(payload: number) {
    const r = await rolesApi.addRogs(payload)
    return unwrap(r)
  },
  async update(id: number, payload: Partial<Role>) {
    // const r = await api.put<any>(`/roles/${id}`, payload)
    const r = await rolesApi.update(id, payload)
    return unwrap(r)
  },
  async remove(id: number) {
    // const r = await api.delete<any>(`/roles/${id}`)
    const r = await rolesApi.remove(id)
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
      setLoading(true)
      try {
        const resp = await roleService.list({ page: p, limit: s, keyword: k || undefined })
        if (!isOk(resp)) throw new Error(getMsg(resp, '加载角色失败'))

        // 1) 主数据
        const arr = ensureArray<Role>(resp, [])
        setList(arr)

        // 2) 分页数字兜底
        const nextTotal = pickTotal(resp, arr.length)
        const nextSize = Number(s)
        const nextPage = Number(p)

        setTotal(Number.isFinite(nextTotal) ? nextTotal : 0)
        setPageSize(Number.isFinite(nextSize) && nextSize > 0 ? nextSize : 10)
        setPage(Number.isFinite(nextPage) && nextPage > 0 ? nextPage : 1)
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
    // 如果当前页删空了，回退一页
    const willLeft = total - 1 - (page - 1) * pageSize
    if (willLeft <= 0 && page > 1) {
      await load(page - 1, pageSize, keyword)
    } else {
      await load(page, pageSize, keyword)
    }
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
