// features/users/hooks/useOrgPathMap.ts
import { useMemo } from 'react'
export function useOrgPathMap(tree: any[]) {
  return useMemo(() => {
    const map = new Map<number, string>()
    const dfs = (n: any, trail: string[]) => {
      const next = [...trail, n.name]
      map.set(n.id, next.join(' - '))
      ;(n.children || []).forEach((c: any) => dfs(c, next))
    }
    ;(tree || []).forEach((r: any) => dfs(r, []))
    return map
  }, [tree])
}
