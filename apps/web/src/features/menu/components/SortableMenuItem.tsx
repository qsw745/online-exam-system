import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { InputNumber } from 'antd'
import { HolderOutlined } from '@ant-design/icons'
import type { MenuDTO } from '@shared/api/endpoints/menu'
import React from 'react'

export default function SortableMenuItem({
  menu,
  index,
  onSortOrderChange,
}: {
  menu: MenuDTO
  index: number
  onSortOrderChange: (from: number, to: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: menu.id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    border: '1px solid #e5e7eb',
    padding: 12,
    borderRadius: 8,
    background: '#fff',
  }
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'shadow' : ''}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span {...attributes} {...(listeners as any)} style={{ cursor: 'grab', color: '#9ca3af' }}>
            <HolderOutlined />
          </span>
          {menu.icon && <span className={`anticon anticon-${menu.icon}`} />}
          <span style={{ fontWeight: 500 }}>{menu.title}</span>
          <span style={{ color: '#9ca3af', fontSize: 12 }}>({menu.name})</span>
          {menu.path && <span style={{ color: '#3b82f6', fontSize: 12 }}>{menu.path}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>当前位置:</span>
          <InputNumber
            size="small"
            value={index}
            min={0}
            onChange={v => typeof v === 'number' && onSortOrderChange(index, v)}
          />
        </div>
      </div>
    </div>
  )
}
