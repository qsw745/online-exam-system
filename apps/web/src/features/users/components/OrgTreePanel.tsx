// features/users/components/OrgTreePanel.tsx
import { ApartmentOutlined, ReloadOutlined } from '@ant-design/icons'
import { Button, Space, Tree, Typography } from 'antd'
const { Text } = Typography
export const OrgTreePanel: React.FC<{
  tree: any[]
  loading: boolean
  expandedKeys: React.Key[]
  setExpandedKeys: (k: React.Key[]) => void
  selectedOrgId: number | null
  onSelect: (id: number) => void
  onRefresh: () => void
}> = ({ tree, loading, expandedKeys, setExpandedKeys, selectedOrgId, onSelect, onRefresh }) => (
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
          icon={<ApartmentOutlined />}
          selectedKeys={selectedOrgId ? [selectedOrgId] : []}
          onSelect={k => onSelect(Number(k?.[0]))}
          expandedKeys={expandedKeys}
          onExpand={k => setExpandedKeys(k as React.Key[])}
          treeData={tree as any}
        />
      )}
    </div>
  </>
)
