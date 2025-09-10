// src/features/users/components/OrgTreePanel.tsx
import { ApartmentOutlined, ReloadOutlined } from '@ant-design/icons'
import { Button, Space, Tree, Typography } from 'antd'
import React from 'react'
const { Text } = Typography

type RawNode = { id: number; name: string; children?: RawNode[] }

function toAntTreeData(nodes: RawNode[] = []): any[] {
  return nodes.map(n => ({
    key: n.id,
    title: n.name,
    icon: <ApartmentOutlined />,
    children: toAntTreeData(n.children || []),
  }))
}

export const OrgTreePanel: React.FC<{
  tree: RawNode[]
  loading: boolean
  expandedKeys: React.Key[]
  setExpandedKeys: (k: React.Key[]) => void
  selectedOrgId: number | null
  onSelect: (id: number) => void
  onRefresh: () => void
}> = ({ tree, loading, expandedKeys, setExpandedKeys, selectedOrgId, onSelect, onRefresh }) => {
  const antTreeData = React.useMemo(() => toAntTreeData(tree), [tree])

  return (
    <>
      <div style={{ padding: 16, borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <ApartmentOutlined />
          <Text strong>机构</Text>
        </Space>
        <Button size="small" icon={<ReloadOutlined />} onClick={onRefresh} />
      </div>
      <div style={{ padding: 12 }}>
        {loading ? (
          <Text type="secondary">加载中...</Text>
        ) : (
          <Tree
            blockNode
            showIcon
            selectedKeys={selectedOrgId != null ? [selectedOrgId] : []}
            onSelect={k => {
              const id = Number(k?.[0])
              if (!Number.isFinite(id)) return
              onSelect(id)
            }}
            expandedKeys={expandedKeys}
            onExpand={k => setExpandedKeys(k as React.Key[])}
            treeData={antTreeData}
          />
        )}
      </div>
    </>
  )
}
