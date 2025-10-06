// apps/web/src/features/menu/pages/UnitMenusPage.tsx
import { OrgTreePanel, type OrgRawNode } from '@/shared/components/OrgTreePanel'
import { useOrgTree } from '@/shared/hooks/useOrgTree'
import { Card } from 'antd'
import React, { useEffect, useMemo, useState } from 'react'
import MenuManagementPage from './MenuManagementPage'

type OrgNode = { id: number; name: string; children?: OrgNode[] }
const toRaw = (nodes: OrgNode[] = []): OrgRawNode[] =>
  nodes.map(n => ({ id: n.id, name: n.name, children: n.children?.length ? toRaw(n.children) : undefined }))

export default function UnitMenusPage() {
  const { filteredTree, loading, refetch, firstId } = useOrgTree()
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null)
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])

  const rawTree: OrgRawNode[] = useMemo(() => toRaw(filteredTree as any), [filteredTree])

  useEffect(() => {
    refetch()
  }, [refetch])

  useEffect(() => {
    if (!rawTree.length) return
    const first = firstId(filteredTree as any)
    if (first && selectedOrgId == null) {
      setSelectedOrgId(first)
      setExpandedKeys(prev => (prev.length ? prev : [first]))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawTree])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, height: '100%', padding: 24 }}>
      <Card
        title="组织"
        variant="outlined"
        style={{ height: '100%', minHeight: 520, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ flex: 1, overflow: 'auto' }}>
          <OrgTreePanel
            title="组织"
            tree={rawTree}
            loading={loading}
            expandedKeys={expandedKeys}
            setExpandedKeys={setExpandedKeys}
            selectedOrgId={selectedOrgId}
            onSelect={id => setSelectedOrgId(id)}
            onRefresh={refetch}
          />
        </div>
      </Card>

      <Card variant="outlined" style={{ height: '100%', minHeight: 520, overflow: 'hidden' }}>
        {/* 切组织时强制重新挂载，触发 useMenus 重新取数 */}
        <MenuManagementPage key={selectedOrgId ?? 'none'} mode="unit" unitId={selectedOrgId ?? undefined} />
      </Card>
    </div>
  )
}
