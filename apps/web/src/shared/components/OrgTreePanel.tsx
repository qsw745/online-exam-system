import { ApartmentOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { Button, Empty, Space, Tree, Typography } from 'antd'
import React from 'react'
import { translate } from '@/shared/utils/i18n'

const { Text } = Typography

export type OrgRawNode = { id: number; name: string; children?: OrgRawNode[] }

function toAntTreeData(nodes: OrgRawNode[] = []): any[] {
  return (nodes || []).map(n => ({
    key: n.id,
    title: n.name,
    icon: <ApartmentOutlined />,
    children: n.children && n.children.length ? toAntTreeData(n.children) : undefined,
  }))
}

export const OrgTreePanel: React.FC<{
  tree: OrgRawNode[]
  loading: boolean
  expandedKeys: React.Key[]
  setExpandedKeys: (k: React.Key[]) => void
  selectedOrgId: number | null
  onSelect: (id: number) => void
  onRefresh: () => void
  /** 传入则显示“新增”按钮；不传则不显示（用户管理通常不需要） */
  onAdd?: () => void
  /** 标题（默认：机构） */
  title?: React.ReactNode
}> = ({ tree, loading, expandedKeys, setExpandedKeys, selectedOrgId, onSelect, onRefresh, onAdd, title }) => {
  const antTreeData = React.useMemo(() => toAntTreeData(tree || []), [tree])

  return (
    <>
      <div style={{ padding: 16, borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <ApartmentOutlined />
          <Text strong>{title ?? translate('users.org_tree.title')}</Text>
        </Space>
        <Space size={8}>
          {onAdd ? (
            <Button size="small" icon={<PlusOutlined />} onClick={onAdd}>
              {translate('orgs.action.add_child')}</Button>
          ) : null}
          <Button size="small" icon={<ReloadOutlined />} onClick={onRefresh} />
        </Space>
      </div>

      <div style={{ padding: 12 }}>
        {loading ? (
          <Text type="secondary">{translate('app.loading')}</Text>
        ) : !antTreeData.length ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={translate('auto.28f1d3e4d9')} />
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
            expandedKeys={Array.isArray(expandedKeys) ? expandedKeys : []}
            onExpand={k => setExpandedKeys((k as React.Key[]) || [])}
            treeData={antTreeData}
          />
        )}
      </div>
    </>
  )
}

export default OrgTreePanel
