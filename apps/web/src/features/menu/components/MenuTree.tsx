import { Button, Popconfirm, Space, Tag, Tree } from 'antd'
import { EditOutlined, CopyOutlined, DeleteOutlined } from '@ant-design/icons'
import type { DataNode, EventDataNode, TreeProps } from 'antd/es/tree'
import type { MenuDTO } from '@shared/api/endpoints/menu'
import { buildTreeData } from '../utils/tree'

export default function MenuTree({
  menus,
  loading,
  onEdit,
  onCopy,
  onDelete,
  onDrop,
}: {
  menus: MenuDTO[]
  loading: boolean
  onEdit: (m: MenuDTO) => void
  onCopy: (m: MenuDTO) => void
  onDelete: (id: number) => void
  onDrop: TreeProps['onDrop']
}) {
  const renderTitle = (m: MenuDTO) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {m.icon && <span className={`anticon anticon-${m.icon}`} />}
        <span style={{ fontWeight: 500 }}>{m.title}</span>
        <span style={{ color: '#9ca3af', fontSize: 12 }}>({m.name})</span>
        <Tag color={m.menu_type === 'menu' ? 'blue' : m.menu_type === 'button' ? 'green' : 'orange'}>
          {m.menu_type === 'menu' ? '菜单' : m.menu_type === 'button' ? '按钮' : '页面'}
        </Tag>
        {m.is_hidden && <Tag color="red">隐藏</Tag>}
        {m.is_disabled && <Tag color="gray">禁用</Tag>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ color: '#6b7280', fontSize: 12, display: 'flex', gap: 8 }}>
          {m.path && <span>路径: {m.path}</span>}
          <span>排序: {m.sort_order}</span>
        </div>
        <Space>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={e => {
              e.stopPropagation()
              onEdit(m)
            }}
          />
          <Button
            type="text"
            size="small"
            icon={<CopyOutlined />}
            onClick={e => {
              e.stopPropagation()
              onCopy(m)
            }}
          />
          {!m.is_system && (
            <Popconfirm
              title="确定删除此菜单吗？"
              onConfirm={e => {
                e?.stopPropagation?.()
                onDelete(m.id)
              }}
            >
              <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={e => e.stopPropagation()} />
            </Popconfirm>
          )}
        </Space>
      </div>
    </div>
  )

  const treeData: DataNode[] = buildTreeData(menus, renderTitle)

  return (
    <Tree treeData={treeData} defaultExpandAll showLine draggable blockNode loading={loading as any} onDrop={onDrop} />
  )
}
