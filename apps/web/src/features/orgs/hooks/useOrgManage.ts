import { App } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DataNode } from 'antd/es/tree'
import { orgs, type OrgNode } from '@/shared/api/endpoints/orgs'

const sortAsc = (a: OrgNode, b: OrgNode) => (a.sort_order ?? 0) - (b.sort_order ?? 0)

function toTreeData(nodes: OrgNode[]): DataNode[] {
  return [...nodes].sort(sortAsc).map(n => ({
    key: n.id,
    title: n.name,
    children: n.children ? toTreeData(n.children) : undefined,
  }))
}

function filterTree(nodes: OrgNode[], kw: string): OrgNode[] {
  if (!kw) return nodes
  const lower = kw.toLowerCase()
  const keep: OrgNode[] = []
  for (const n of nodes) {
    const hit = n.name.toLowerCase().includes(lower)
    const children = n.children ? filterTree(n.children, kw) : []
    if (hit || children.length) keep.push({ ...n, children })
  }
  return keep
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
      try {
        setTreeLoading(true)
        const { data } = await orgs.tree()
        setTree(data || [])
        if (keepSelection && selectedId != null) {
          const exists = (list: OrgNode[], id: number): boolean =>
            list.some(n => n.id === id || (n.children?.length ? exists(n.children, id) : false))
          if (!exists(data || [], selectedId)) setSelectedId(null)
        }
      } catch (e: any) {
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
      try {
        setDetailLoading(true)
        const { data } = await orgs.get(id)
        setDetail(data)
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
    loadTree(false)
  }, []) // 初次加载树
  useEffect(() => {
    void loadDetail(selectedId)
  }, [selectedId, loadDetail])

  const createOrg = useCallback(
    async (payload: Partial<OrgNode>) => {
      await orgs.create(payload)
      await loadTree(true)
    },
    [loadTree]
  )

  const updateOrg = useCallback(
    async (id: number, payload: Partial<OrgNode>) => {
      await orgs.update(id, payload)
      await loadTree(true)
      const fresh = await orgs.get(id)
      setDetail(fresh.data)
    },
    [loadTree]
  )

  const removeOrg = useCallback(
    async (id: number) => {
      await orgs.remove(id)
      await loadTree(false)
      setSelectedId(null)
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
