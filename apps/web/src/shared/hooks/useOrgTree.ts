import { orgsApi, type OrgNode } from '@/shared/api/endpoints/orgs'
import { App } from 'antd'
import { useCallback, useMemo, useState } from 'react'

const safe = (v?: string | null) => (v ?? '').toString()

/** 仅做名称过滤，保持层级 */
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

/** 公共组织树 Hook：获取/搜索/工具函数（不再管理 expanded） */
export function useOrgTree() {
  const { message } = App.useApp()

  const [loading, setLoading] = useState(false)
  const [tree, setTree] = useState<OrgNode[]>([])
  const [search, setSearch] = useState('')

  const filteredTree = useMemo(() => filterTree(tree, search), [tree, search])

  /** 拉取组织树；返回最新列表，便于调用方基于返回值更新本地状态 */
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

  return {
    // 数据
    tree,
    loading,
    // 搜索
    search,
    setSearch,
    filteredTree,
    // 动作
    refetch,
    // 工具
    exists,
    firstId,
  }
}

export default useOrgTree
