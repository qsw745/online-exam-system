import { message } from 'antd'
import { useEffect, useState, useCallback } from 'react'
import { questionsApi, isSuccess } from '@/shared/api/http'
import { getMsg } from '@/shared/utils/q-helpers'

export type Question = {
  id: string
  content: string
  question_type: string
  difficulty?: 'easy' | 'medium' | 'hard' | string
  tags?: string[]
  knowledge_points?: string[]
  score?: number
  created_at?: string | number | Date
}

export function useQuestionQuery() {
  const [loading, setLoading] = useState(true)
  const [list, setList] = useState<Question[]>([])
  const [total, setTotal] = useState(0)

  // 筛选/分页
  const [search, setSearch] = useState('')
  const [type, setType] = useState<'all' | Question['question_type']>('all')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // 防抖
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  // 标签选项
  const reloadTags = useCallback(async () => {
    try {
      const res = await (questionsApi as any).getTags?.()
      if (isSuccess(res) && Array.isArray(res.data)) setAllTags(res.data)
    } catch {}
  }, [])
  useEffect(() => void reloadTags(), [reloadTags])

  // 加载列表
  const load = useCallback(async () => {
    try {
      setLoading(true)
      const params: any = {
        page,
        limit: pageSize,
        keyword: debouncedSearch || undefined,
        search: debouncedSearch || undefined,
        type: type === 'all' ? undefined : type,
        tags: selectedTags.length ? selectedTags.join(',') : undefined,
      }
      const res: any = await questionsApi.list(params)
      if (!isSuccess(res)) {
        message.error(getMsg(res, '加载题目失败'))
        setList([])
        setTotal(0)
        return
      }
      const d = res.data
      if (Array.isArray(d)) {
        setList(d as Question[])
        setTotal(d.length)
      } else if (d && typeof d === 'object') {
        const arr = (d.questions ?? d.items ?? []) as Question[]
        setList(Array.isArray(arr) ? arr : [])
        const pg = d.pagination ?? {}
        setTotal(pg.total ?? d.total ?? arr.length ?? 0)
      } else {
        setList([])
        setTotal(0)
      }
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, debouncedSearch, type, selectedTags])

  useEffect(() => void load(), [load])

  return {
    // data
    loading,
    list,
    total,
    // filters & pagination
    search,
    setSearch,
    type,
    setType,
    selectedTags,
    setSelectedTags,
    allTags,
    page,
    setPage,
    pageSize,
    setPageSize,
    // reload
    reload: load,
    reloadTags,
  }
}

export default useQuestionQuery
