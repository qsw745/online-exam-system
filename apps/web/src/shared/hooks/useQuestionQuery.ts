// src/shared/hooks/useQuestionQuery.ts
import { message } from 'antd'
import { useEffect, useState } from 'react'
import { questionsApi, isSuccess } from '@shared/api/http'

// 最小化 Question 类型，避免依赖缺失
export type Question = {
  id: string
  content: string
  question_type: string
  difficulty?: 'easy' | 'medium' | 'hard' | string
  tags?: string[]
  score?: number
}

function getMsg(res: any, fallback = '请求失败') {
  return (
    res?.error ||
    res?.message ||
    res?.data?.error ||
    res?.data?.message ||
    (typeof res === 'string' ? res : null) ||
    fallback
  )
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

  // 标签选项（若后端未提供 getTags 可忽略）
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
        // 一些后端使用 keyword，这里兼容传 search，同时交给后端忽略未知字段
        search: debouncedSearch || undefined,
        keyword: debouncedSearch || undefined,
        type: type === 'all' ? undefined : type,
        tags: selectedTags.length ? selectedTags.join(',') : undefined,
      }
      // 修复：使用 list 而不是 getAll
      const res: any = await questionsApi.list(params as any)

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
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, debouncedSearch, type, selectedTags.join('|')])

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

export default useQuestionQuery
