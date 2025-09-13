import { orgsApi, type OrgNode } from '@/shared/api/endpoints/orgs'
import { App } from 'antd'
import { useCallback, useMemo, useState } from 'react'

const safe = (v?: string | null) => (v ?? '').toString()

function filterTree(nodes: OrgNode[] = [], kw: string): OrgNode[] {
  const q = kw.trim().toLowerCase()
  if (!q) return nodes
  const keep: OrgNode[] = []
  for (const n of nodes) {
    const hit = safe(n.name).toLowerCase().includes(q)
    const children = filterTree(n.children || [], kw)
    if (hit || children.length) keep.push({ ...n, children })
  }
  return keep
}

function exists(nodes: OrgNode[] = [], id: number): boolean {
  return nodes.some(n => n.id === id || exists(n.children || [], id))
}

function firstId(list: OrgNode[]): number | null {
  return list && list.length ? (typeof list[0].id === 'number' ? list[0].id : null) : null
}

export function useOrgTree() {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [tree, setTree] = useState<OrgNode[]>([])
  const [search, setSearch] = useState('')

  const filteredTree = useMemo(() => filterTree(tree, search), [tree, search])

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const list = await orgsApi.tree()
      const next = Array.isArray(list) ? list : []
      setTree(next)
      return next
    } catch (e: any) {
      message.error(e?.message || '加载组织树失败')
      setTree([])
      return []
    } finally {
      setLoading(false)
    }
  }, [message])

  // ✅ 若还没加载过则拉一次；否则直接返回现有数据
  const ensureFetched = useCallback(async () => {
    if (!tree.length) {
      return await refetch()
    }
    return tree
  }, [tree, refetch])

  return {
    tree,
    loading,
    search,
    setSearch,
    filteredTree,
    refetch,
    ensureFetched,
    exists,
    firstId,
  }
}

export default useOrgTree
