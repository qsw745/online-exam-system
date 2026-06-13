import { isSuccess, questionsApi } from '@/shared/api/http'
import { getMsg } from '@/shared/utils/q-helpers'
import { message } from 'antd'
import { useCallback, useEffect, useState } from 'react'

export type Question = {
  id: string
  content: string
  question_type: string
  difficulty?: 'easy' | 'medium' | 'hard' | string
  tags?: string[]
  knowledge_points?: string[]
  score?: number
  created_at?: string | number | Date
  title?: string
  /** ↓ 分组模式下额外带回，方便需要时做分组渲染 */
  __dup_group__?: string // `${title}__${question_type}`
  __dup_count__?: number // 该组重复条数
}

export function useQuestionQuery() {
  const [loading, setLoading] = useState(true)
  const [list, setList] = useState<Question[]>([])
  const [total, setTotal] = useState(0)

  // 是否是“分组（重复题）模式”，用于分页显示文案等
  const [isGrouped, setIsGrouped] = useState(false)

  // 筛选/分页
  const [search, setSearch] = useState('')
  const [type, setType] = useState<'all' | Question['question_type']>('all')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // 只看重复
  const [dupOnly, setDupOnly] = useState(false)

  // 防抖
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  // 标签
  const reloadTags = useCallback(async () => {
    try {
      const res = await questionsApi.getTags()
      if (isSuccess<string[]>(res) && Array.isArray(res.data)) setAllTags(res.data)
      else setAllTags([])
    } catch {
      setAllTags([])
    }
  }, [])
  useEffect(() => void reloadTags(), [reloadTags])

  // 加载列表（兼容分组返回）
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
        // 重复模式：请求后端按【标题+类型】查重，并“分组返回”
        duplicates: dupOnly ? 'title_type' : undefined,
        grouped: dupOnly ? 'true' : undefined, // 分组模式时让后端返回 groups
      }
      const res: any = await questionsApi.list(params)
      if (!isSuccess(res)) {
        message.error(getMsg(res, '加载题目失败'))
        setIsGrouped(false)
        setList([])
        setTotal(0)
        setIsGrouped(false)
        return
      }

      const d = res.data

      // ★★★ 分组返回：把 groups 拍平为表格行，同时保留组信息
      if (d?.grouped === true && Array.isArray(d.groups)) {
        setIsGrouped(true)
        const flat: Question[] = d.groups.flatMap((g: any) =>
          (Array.isArray(g.items) ? g.items : []).map((it: any) => ({
            ...it,
            __dup_group__: `${g.title}__${g.question_type}`,
            __dup_count__: Number(g.dup_count || 0),
          }))
        )
        setList(flat)
        // 注意：后端分页是“按组分页”，这里 total 取“组数”
        setTotal(Number(d?.pagination?.totalGroups ?? flat.length))
        return
      }

      // 兼容旧结构（平铺列表）
      setIsGrouped(false)
      if (Array.isArray(d)) {
        setList(d as Question[])
        setTotal(d.length)
      } else if (d && typeof d === 'object') {
        const arr = (d.questions ?? d.items ?? []) as Question[]
        setList(Array.isArray(arr) ? arr : [])
        const pg = d.pagination ?? {}
        setTotal(pg.total ?? d.total ?? (Array.isArray(arr) ? arr.length : 0))
      } else {
        setList([])
        setTotal(0)
      }
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, debouncedSearch, type, selectedTags, dupOnly])

  useEffect(() => void load(), [load])

  return {
    // data
    loading,
    list,
    total,
    isGrouped,
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
    // 重复模式
    dupOnly,
    setDupOnly,
    // reloaders
    reload: load,
    reloadTags,
  }
}

export default useQuestionQuery
