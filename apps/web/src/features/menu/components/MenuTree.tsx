import type { MenuDTO } from '@/shared/api/endpoints/menu'
import { CopyOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { Button, Popconfirm, Space, Spin, Tag, Tree } from 'antd' // <-- 引入 Spin

import { buildTreeData } from '@/shared/utils/tree'
import type { DataNode, TreeProps } from 'antd/es/tree'

export default function MenuTree({
  menus,
  loading,
  readOnly = false,
  onEdit,
  onCopy,
  onDelete,
  onDrop,
}: {
  menus: MenuDTO[]
  loading: boolean
  /** 只读模式（功能菜单页）：不显示操作按钮，不允许拖动 */
  readOnly?: boolean
  onEdit?: (m: MenuDTO) => void
  onCopy?: (m: MenuDTO) => void
  onDelete?: (id: number) => void
  onDrop?: TreeProps['onDrop']
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

      {!readOnly && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ color: '#6b7280', fontSize: 12, display: 'flex', gap: 8 }}>
            {m.path && <span>路径: {m.path}</span>}
            <span>排序: {m.sort_order}</span>
          </div>
          <Space>
            {onEdit && (
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={e => {
                  e.stopPropagation()
                  onEdit(m)
                }}
              />
            )}
            {onCopy && (
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={e => {
                  e.stopPropagation()
                  onCopy(m)
                }}
              />
            )}
            {onDelete && !m.is_system && (
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
      )}
    </div>
  )

  const treeData: DataNode[] = buildTreeData(menus, renderTitle)

  return (
    <Spin spinning={loading}>
      <Tree
        treeData={treeData}
        defaultExpandAll
        showLine
        draggable={!readOnly}
        blockNode
        onDrop={readOnly ? undefined : onDrop}
      />
    </Spin>
  )
}
