import { Modal, Space, Typography } from 'antd'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import SortableMenuItem from './SortableMenuItem'
import type { MenuDTO } from '@/shared/api/endpoints/menu'

export default function BatchSortModal({
  open,
  items,
  setItems,
  onOk,
  onCancel,
}: {
  open: boolean
  items: MenuDTO[]
  setItems: (updater: (prev: MenuDTO[]) => MenuDTO[]) => void
  onOk: () => void
  onCancel: () => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const onDragEnd = (event: any) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setItems(items => {
      const oldIndex = items.findIndex(x => x.id === active.id)
      const newIndex = items.findIndex(x => x.id === over.id)
      return arrayMove(items, oldIndex, newIndex)
    })
  }

  return (
    <Modal title="批量调整菜单排序" open={open} onOk={onOk} onCancel={onCancel} width={800} destroyOnHidden>
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <Typography.Paragraph style={{ color: '#4b5563', marginBottom: 0 }}>
          拖拽下方列表项来调整菜单排序，或直接修改“当前位置”：
        </Typography.Paragraph>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map(m => m.id)} strategy={verticalListSortingStrategy}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {items.map((m, i) => (
                <SortableMenuItem
                  key={m.id}
                  menu={m}
                  index={i}
                  onSortOrderChange={(from, to) => {
                    if (to < 0 || to >= items.length) return
                    setItems(prev => {
                      const copy = [...prev]
                      const [moved] = copy.splice(from, 1)
                      copy.splice(to, 0, moved)
                      return copy
                    })
                  }}
                />
              ))}
            </Space>
          </SortableContext>
        </DndContext>
      </Space>
    </Modal>
  )
}
