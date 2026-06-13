import { orgsApi, type OrgNode } from '@/shared/api/endpoints/orgs'
import { useOrgTree } from '@/shared/hooks/useOrgTree'
import { App } from 'antd'
import { useCallback, useEffect, useState } from 'react'

export function useOrgManage() {
  const { message } = App.useApp()

  // 公共树：获取 + 搜索 + 过滤
  const { tree, loading: treeLoading, search, setSearch, filteredTree, refetch, exists, firstId } = useOrgTree()

  // 详情
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<OrgNode | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // 首次加载树，并设置默认选中根
  useEffect(() => {
    ;(async () => {
      await refetch()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 树数据变化时，确保有默认选中
  useEffect(() => {
    if (!tree?.length) return
    if (selectedId == null || !Number.isFinite(selectedId) || !exists(tree, selectedId)) {
      setSelectedId(firstId(tree))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree])

  const loadDetail = useCallback(
    async (id: number | null) => {
      if (!id) {
        setDetail(null)
        return
      }
      setDetailLoading(true)
      try {
        const data = await orgsApi.get(id) // ✅ 此处直接得到 OrgNode
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

  // 选中变化 => 取详情
  useEffect(() => {
    void loadDetail(selectedId)
  }, [selectedId, loadDetail])

  const loadTree = useCallback(
    async (keepSelection = true) => {
      const next = await refetch() // 推荐你的 useOrgTree.refetch 返回最新树；若当前实现没有返回值，保留原逻辑也可
      const latestTree = Array.isArray(next) && next.length ? next : tree

      if (!keepSelection) {
        setSelectedId(firstId(latestTree))
      } else if (selectedId != null && !exists(latestTree, selectedId)) {
        setSelectedId(firstId(latestTree))
      }
    },
    [refetch, selectedId, tree, exists, firstId]
  )

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
      const ret = await orgsApi.remove(id)
      await loadTree(false)
      setDetail(null)
      return ret
    },
    [loadTree]
  )

  return {
    // 列表/树
    treeLoading,
    rawTree: filteredTree, // 左侧树直接吃这个（保持后端结构）
    search,
    setSearch,

    // 详情
    selectedId,
    setSelectedId,
    detail,
    detailLoading,

    // 动作
    loadTree,
    loadDetail,
    createOrg,
    updateOrg,
    removeOrg,
  }
}
