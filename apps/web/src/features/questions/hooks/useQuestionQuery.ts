import { useEffect, useMemo, useState } from 'react'
import { message } from 'antd'
import { questionsApi } from '../api'
import { isSuccess, getMsg } from '../utils/api-result'
import type { Question } from '../types/question'

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
  useEffect(() => {
    ;(async () => {
      try {
        const res = await (questionsApi as any).getTags?.()
        if (isSuccess(res) && Array.isArray(res.data)) setAllTags(res.data)
      } catch {}
    })()
  }, [])

  // 加载列表
  const load = async () => {
    try {
      setLoading(true)
      const params: any = {
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        type: type === 'all' ? undefined : type,
        tags: selectedTags.length ? selectedTags.join(',') : undefined,
      }
      const res: any = await questionsApi.getAll(params)
      if (!isSuccess(res)) {
        message.error(getMsg(res, '加载题目失败'))
        setList([])
        setTotal(0)
        return
      }
      const d = res.data
      if (Array.isArray(d)) {
        setList(d)
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
  }

  useEffect(() => {
    load()
  }, [page, pageSize, debouncedSearch, type, selectedTags])

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
  }
}
