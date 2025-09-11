// src/pages/hooks/useOrgManage.ts
import { orgsApi, type OrgNode } from '@/shared/api/endpoints/orgs'
import { App } from 'antd'
import type { DataNode } from 'antd/es/tree'
import { useCallback, useEffect, useMemo, useState } from 'react'

const sortAsc = (a: OrgNode, b: OrgNode) => (Number(a.sort_order ?? a.id) || 0) - (Number(b.sort_order ?? b.id) || 0)

const safeName = (v?: string | null) => (v ?? '').toString()

function toTreeData(nodes: OrgNode[]): DataNode[] {
  return (nodes || []).sort(sortAsc).map(n => ({
    key: n.id,
    title: safeName(n.name) || `未命名（#${n.id}）`,
    children: n.children && n.children.length ? toTreeData(n.children) : undefined,
  }))
}

function filterTree(nodes: OrgNode[], kw: string): OrgNode[] {
  if (!kw) return nodes
  const lower = kw.toLowerCase()
  const keep: OrgNode[] = []
  for (const n of nodes) {
    const hit = safeName(n.name).toLowerCase().includes(lower)
    const children = n.children ? filterTree(n.children, kw) : []
    if (hit || children.length) keep.push({ ...n, children })
  }
  return keep
}

function firstId(list: OrgNode[]): number | null {
  return list && list.length ? list[0].id ?? null : null
}

export function useOrgManage() {
  const { message } = App.useApp()
  const [tree, setTree] = useState<OrgNode[]>([])
  const [treeLoading, setTreeLoading] = useState(false)

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<OrgNode | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [search, setSearch] = useState('')

  const filteredTreeData = useMemo(() => toTreeData(filterTree(tree, search.trim())), [tree, search])

  const loadTree = useCallback(
    async (keepSelection = true) => {
      setTreeLoading(true)
      try {
        const list = await orgsApi.tree()
        setTree(list)

        if (keepSelection) {
          const exists = (arr: OrgNode[], id: number): boolean =>
            arr.some(x => x.id === id || (x.children?.length ? exists(x.children, id) : false))

          if (selectedId != null && exists(list, selectedId)) {
            // 保持当前选中
          } else {
            setSelectedId(firstId(list)) // 默认选中根
          }
        } else {
          setSelectedId(firstId(list)) // 首次加载默认选中根
        }
      } catch (e: any) {
        setTree([])
        message.error(e?.message || '加载组织树失败')
      } finally {
        setTreeLoading(false)
      }
    },
    [message, selectedId]
  )

  const loadDetail = useCallback(
    async (id: number | null) => {
      if (!id) {
        setDetail(null)
        return
      }
      setDetailLoading(true)
      try {
        const data = await orgsApi.get(id)
        setDetail(data || null)
      } catch (e: any) {
        setDetail(null)
        message.error(e?.message || '加载组织详情失败')
      } finally {
        setDetailLoading(false)
      }
    },
    [message]
  )

  useEffect(() => {
    loadTree(false) // 首次加载
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void loadDetail(selectedId)
  }, [selectedId, loadDetail])

  const createOrg = useCallback(
    async (payload: Partial<OrgNode>) => {
      await orgsApi.create(payload)
      await loadTree(true)
    },
    [loadTree]
  )

  const updateOrg = useCallback(
    async (id: number, payload: Partial<OrgNode>) => {
      await orgsApi.update(id, payload)
      await loadTree(true)
      const fresh = await orgsApi.get(id)
      setDetail(fresh || null)
    },
    [loadTree]
  )

  const removeOrg = useCallback(
    async (id: number) => {
      await orgsApi.remove(id)
      await loadTree(false)
      setDetail(null)
    },
    [loadTree]
  )

  return {
    // state
    treeLoading,
    filteredTreeData,
    search,
    selectedId,
    detail,
    detailLoading,

    // setters
    setSearch,
    setSelectedId,

    // actions
    loadTree,
    loadDetail,
    createOrg,
    updateOrg,
    removeOrg,
  }
}
