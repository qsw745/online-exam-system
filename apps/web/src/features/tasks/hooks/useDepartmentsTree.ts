import * as http from '@/shared/api/http'
import { App } from 'antd'
import { useCallback, useMemo, useState } from 'react'

type OrgNode = {
  id: number
  name?: string
  title?: string
  parent_id?: number | null
  parentId?: number | null
  children?: OrgNode[]
}

/** 部门树：key===value===String(id)，保证回显 */
export function useDepartmentsTree() {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [raw, setRaw] = useState<OrgNode[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // ✅ 正确 await
      let payload: any[] = []
      if ((http as any).orgsApi?.tree) {
        const arr: OrgNode[] = await (http as any).orgsApi.tree()
        payload = Array.isArray(arr) ? arr : []
      } else if ((http as any).api?.get) {
        const r = await (http as any).api.get('/orgs/tree')
        payload = Array.isArray(r?.data) ? r.data : []
      }

      // 兼容后端返回扁平/树两种结构
      const list = payload?.departments ?? payload?.items ?? payload?.list ?? (Array.isArray(payload) ? payload : [])

      setRaw(Array.isArray(list) ? list : [])
    } catch (e: any) {
      console.error(e)
      message.error(e?.message || '加载部门失败')
      setRaw([])
    } finally {
      setLoading(false)
    }
  }, [message])

  const treeData = useMemo(() => {
    if (!raw.length) return []

    // 若已有 children，直接递归映射
    const hasChildren = raw.some(n => Array.isArray((n as any).children))
    if (hasChildren) {
      const mapNode = (n: OrgNode): any => ({
        title: n.name || n.title || `部门${n.id}`,
        value: String(n.id),
        key: String(n.id), // ✅ key===value
        selectable: true,
        children: (n.children || []).map(mapNode),
      })
      return raw.map(mapNode)
    }

    // 否则按 parent_id 组树
    const map = new Map<number, any>()
    const roots: any[] = []

    for (const d of raw) {
      const value = String(d.id)
      map.set(Number(d.id), {
        title: d.name || d.title || `部门${d.id}`,
        value,
        key: value,
        selectable: true,
        children: [] as any[],
      })
    }
    for (const d of raw) {
      const pid = d.parent_id ?? d.parentId ?? null
      const node = map.get(Number(d.id))
      if (pid && map.has(Number(pid))) {
        map.get(Number(pid)).children.push(node)
      } else {
        roots.push(node)
      }
    }
    return roots
  }, [raw])

  return { loading, treeData, load }
}

export default useDepartmentsTree
