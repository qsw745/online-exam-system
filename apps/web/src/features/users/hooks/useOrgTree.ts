// features/users/hooks/useOrgTree.ts
import { useEffect, useMemo, useState } from 'react'
import { orgsService } from '../services/orgs.service'

export function useOrgTree() {
  const [tree, setTree] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<React.Key[]>([])
  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const t = await orgsService.tree()
        setTree(t)
        const collect = (nodes: any[] = []) => nodes.flatMap((n: any) => [n.id, ...collect(n.children || [])])
        setExpanded(collect(t))
      } finally {
        setLoading(false)
      }
    })()
  }, [])
  return { tree, loading, expanded, setExpanded }
}
