// hooks/useRoles.ts
import { useCallback, useState } from 'react'
import { App } from 'antd'
import { roleService } from '../services/roles'
import { isSuccess, getMsg } from '../utils/apiResult'
import { ensureArray, pickTotal } from '../utils/normalizers'
import type { Role } from '../types'

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
        if (!isSuccess(resp)) throw new Error(getMsg(resp, '加载角色失败'))
        const d = resp.data as any
        const arr = ensureArray<Role>(d, [])
        setList(arr)
        setTotal(arr.length ? pickTotal(d, arr.length) : pickTotal(d, 0))
        setPage(p)
        setPageSize(s)
      } catch (e: any) {
        console.error(e)
        message.error(e.message || '加载角色失败')
        setList([])
        setTotal(0)
      } finally {
        setLoading(false)
      }
    },
    [page, pageSize, keyword]
  )

  const create = async (payload: Partial<Role>) => {
    const r = await roleService.create(payload)
    if (!isSuccess(r)) throw new Error(getMsg(r, '角色创建失败'))
    await load(1, pageSize, keyword)
  }
  const update = async (id: number, payload: Partial<Role>) => {
    const r = await roleService.update(id, payload)
    if (!isSuccess(r)) throw new Error(getMsg(r, '角色更新失败'))
    await load(page, pageSize, keyword)
  }
  const remove = async (id: number) => {
    const r = await roleService.remove(id)
    if (!isSuccess(r)) throw new Error(getMsg(r, '删除失败'))
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
