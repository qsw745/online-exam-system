import { orgsApi } from '@/shared/api/http'
import { App } from 'antd'
import { useEffect, useMemo, useState } from 'react'

type TreeNode = { id: number; name: string; children?: TreeNode[] }
export type AntTreeNode = { key: number; title: string; children?: AntTreeNode[] }

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

  const tree = useMemo(() => toAnt(raw), [raw])

  const fetchTree = async () => {
    setLoading(true)
    try {
      //   const r = await api.get<TreeNode[]>('/orgs/tree')
      const r: any = await orgsApi.tree()
      console.log('rrrr', r)
      if (r) {
        // const list = Array.isArray(r.data) ? r.data : []
        const list = r
        console.log('list', list)
        setRaw(list)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { tree, loading, refetch: fetchTree }
}
