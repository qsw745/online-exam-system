import { App } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { api, isSuccess } from '@shared/api/http'

type TreeNode = { id: number; name: string; children?: TreeNode[] }
type AntTreeNode = { key: number; title: string; children?: AntTreeNode[] }

function toAnt(nodes: TreeNode[] = []): AntTreeNode[] {
  return nodes.map(n => ({
    key: n.id,
    title: n.name,
    children: n.children?.length ? toAnt(n.children) : undefined,
  }))
}

export function useOrgTree() {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [raw, setRaw] = useState<TreeNode[]>([])
  const [expanded, setExpanded] = useState<React.Key[]>([])

  const tree = useMemo(() => toAnt(raw), [raw])

  const fetchTree = async () => {
    setLoading(true)
    try {
      const r = await api.get<TreeNode[]>('/orgs/tree')
      if (isSuccess(r)) {
        const list = Array.isArray(r.data) ? r.data : []
        setRaw(list)
        // 初始全部展开（可按需精简）
        setExpanded(list.map(n => n.id))
      } else {
        throw new Error((r as any).error || '加载机构树失败')
      }
    } catch (e: any) {
      message.error(e?.message || '加载机构树失败')
      setRaw([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTree()
  }, [])

  return { tree, loading, expanded, setExpanded, refetch: fetchTree }
}

export default useOrgTree
