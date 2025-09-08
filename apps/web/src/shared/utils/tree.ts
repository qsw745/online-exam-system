import type { DataNode } from 'antd/es/tree'
import type { MenuDTO } from '@shared/api/endpoints/menu'

export const STEP = 10 // sort_order 步长

export function isInSubtree(all: MenuDTO[], ancestorId: number, candidateId?: number | null) {
  if (candidateId == null) return false
  const map = new Map<number, MenuDTO>(all.map(m => [m.id, m]))
  let cur = map.get(candidateId)
  while (cur) {
    if ((cur.parent_id ?? null) === ancestorId) return true
    if (cur.parent_id == null) break
    cur = map.get(cur.parent_id)
  }
  return false
}

export function buildLayerUpdates(layer: MenuDTO[], draggedId: number, forcedParent: number | null) {
  return layer.map((m, i) => ({
    id: m.id,
    parent_id: m.id === draggedId ? forcedParent : m.parent_id ?? null,
    sort_order: i * STEP,
  }))
}

/** 纯数据构树（不含按钮），UI 里再渲染操作区 */
export function groupByParent(list: MenuDTO[]) {
  const map = new Map<number | null, MenuDTO[]>()
  for (const m of list) {
    const pid = m.parent_id ?? null
    const arr = map.get(pid) ?? []
    arr.push(m)
    map.set(pid, arr)
  }
  return map
}

export function sortAsc(a: MenuDTO, b: MenuDTO) {
  return (a.sort_order ?? 0) - (b.sort_order ?? 0)
}

export function buildTreeData(list: MenuDTO[], renderTitle: (m: MenuDTO) => React.ReactNode): DataNode[] {
  const byParent = groupByParent(list)
  const makeNodes = (pid: number | null): DataNode[] =>
    (byParent.get(pid) ?? []).sort(sortAsc).map(m => ({
      key: m.id,
      title: renderTitle(m),
      children: makeNodes(m.id),
    }))
  return makeNodes(null)
}
