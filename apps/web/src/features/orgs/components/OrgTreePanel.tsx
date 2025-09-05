import { Button, Card, Input, Space, Spin, Tree } from 'antd'
import type { DataNode, EventDataNode } from 'antd/es/tree'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'

export default function OrgTreePanel({
  loading,
  treeData,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  onRefresh,
  onAdd,
}: {
  loading: boolean
  treeData: DataNode[]
  selectedId: number | null
  search: string
  onSearchChange: (v: string) => void
  onRefresh: () => void
  onAdd: () => void
  onSelect: (_keys: React.Key[], info: { node: EventDataNode<DataNode> }) => void
}) {
  return (
    <div style={{ padding: 12 }}>
      <Space.Compact style={{ width: '100%' }}>
        <Input.Search
          allowClear
          placeholder="搜索组织..."
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          onSearch={onSearchChange}
        />
      </Space.Compact>

      <Space style={{ marginTop: 8 }}>
        <Button icon={<ReloadOutlined />} onClick={onRefresh}>
          刷新
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
          新增组织
        </Button>
      </Space>

      <div style={{ padding: '12px 0' }}>
        <Card size="small" styles={{ body: { padding: 0 } }}>
          <div style={{ height: 'calc(100vh - 200px)', overflow: 'auto' }}>
            <Spin spinning={loading}>
              <Tree
                showLine
                selectedKeys={selectedId ? [String(selectedId)] : []}
                onSelect={onSelect}
                treeData={treeData}
                height={700}
              />
            </Spin>
          </div>
        </Card>
      </div>
    </div>
  )
}
