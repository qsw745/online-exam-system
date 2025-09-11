// apps/web/src/features/orgs/hooks/useOrgManage.ts
import { orgsApi, type OrgNode } from '@/shared/api/endpoints/orgs'
import { App } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'

const safeName = (v?: string | null) => (v ?? '').toString()

/** 仅做名称过滤；保持后端树形结构不变 */
function filterTree(nodes: OrgNode[] = [], kw: string): OrgNode[] {
  const lower = kw.trim().toLowerCase()
  if (!lower) return nodes
  const keep: OrgNode[] = []
  for (const n of nodes) {
    const hit = safeName(n.name).toLowerCase().includes(lower)
    const children = n.children?.length ? filterTree(n.children, kw) : []
    if (hit || children.length) keep.push({ ...n, children })
  }
  return keep
}

function firstId(list: OrgNode[]): number | null {
  return list && list.length ? list[0].id ?? null : null
}

export function useOrgManage() {
  const { message } = App.useApp()

  // 直接存放后端返回的树根数组
  const [tree, setTree] = useState<OrgNode[]>([])
  const [treeLoading, setTreeLoading] = useState(false)

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<OrgNode | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [search, setSearch] = useState('')

  // 左侧树直接用过滤后的“后端树结构”
  const rawTree = useMemo(() => filterTree(tree, search), [tree, search])

  const loadTree = useCallback(
    async (keepSelection = true) => {
      setTreeLoading(true)
      try {
          const list = await orgsApi.tree()
          console.log(list);
        const arr = Array.isArray(list) ? list : []
        setTree(arr)

        const rootId = firstId(arr)
        if (keepSelection && selectedId != null) {
          const exists = (arr2: OrgNode[], id: number): boolean =>
            arr2.some(x => x.id === id || (x.children?.length ? exists(x.children, id) : false))
          if (!exists(arr, selectedId)) setSelectedId(rootId)
        } else {
          setSelectedId(rootId)
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
    loadTree(false) // 首次加载默认选中根
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
      const ret = await orgsApi.remove(id) // { message }
      await loadTree(false)
      setDetail(null)
      return ret
    },
    [loadTree]
  )

  return {
    // state
    treeLoading,
    rawTree,
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
