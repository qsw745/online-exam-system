import {
  CopyOutlined,
  DeleteOutlined,
  DragOutlined,
  EditOutlined,
  ExportOutlined,
  HolderOutlined,
  ImportOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { App, Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Tag, Tree } from 'antd'
import type { EventDataNode, TreeDataNode } from 'antd/es/tree'
import React, { useEffect, useState } from 'react'
import { api } from '../../lib/api'

interface Menu {
  id: number
  name: string
  title: string
  path?: string
  component?: string
  icon?: string
  parent_id?: number
  sort_order: number
  level: number
  is_hidden: boolean
  is_disabled: boolean
  is_system: boolean
  menu_type: 'menu' | 'button' | 'page'
  permission_code?: string
  redirect?: string
  meta?: string
  created_at: string
  updated_at: string
}

interface MenuFormData {
  name: string
  title: string
  path?: string
  component?: string
  icon?: string
  parent_id?: number
  sort_order: number
  is_hidden: boolean
  is_disabled: boolean
  menu_type: 'menu' | 'button' | 'page'
  permission_code?: string
  redirect?: string
  meta?: string
}

// 可拖拽的菜单项组件
interface SortableMenuItemProps {
  menu: Menu
  index: number
  onSortOrderChange: (index: number, newSortOrder: number) => void
}

const SortableMenuItem: React.FC<SortableMenuItemProps> = ({ menu, index, onSortOrderChange }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: menu.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-3 border rounded hover:bg-gray-50 ${
        isDragging ? 'shadow-lg' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <div {...attributes} {...listeners} className="cursor-move">
          <HolderOutlined className="text-gray-400" />
        </div>
        {menu.icon && <span className={`anticon anticon-${menu.icon}`} />}
        <span className="font-medium">{menu.title}</span>
        <span className="text-gray-400 text-sm">({menu.name})</span>
        {menu.path && <span className="text-blue-500 text-sm">{menu.path}</span>}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">排序:</span>
        <InputNumber
          size="small"
          value={index}
          min={0}
          onChange={value => {
            if (value !== null && value !== undefined) {
              onSortOrderChange(index, value)
            }
          }}
        />
      </div>
    </div>
  )
}

const MenuManagementPage: React.FC = () => {
  const { message } = App.useApp()
  const [menus, setMenus] = useState<Menu[]>([])
  const [treeData, setTreeData] = useState<TreeDataNode[]>([])
  const [loading, setLoading] = useState(false)

  // 菜单相关状态
  const [menuModalVisible, setMenuModalVisible] = useState(false)
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null)
  const [menuForm] = Form.useForm()

  const [iconPreview, setIconPreview] = useState<string>('')
  const [draggedNode, setDraggedNode] = useState<EventDataNode<TreeDataNode> | null>(null)
  const [batchSortVisible, setBatchSortVisible] = useState(false)
  const [batchSortMenus, setBatchSortMenus] = useState<Menu[]>([])

  // 拖拽传感器
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    loadMenus()
  }, [])

  // 处理拖拽结束
  const handleDragEnd = (event: any) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      setBatchSortMenus(items => {
        const oldIndex = items.findIndex(item => item.id === active.id)
        const newIndex = items.findIndex(item => item.id === over.id)

        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  // 处理排序号变更
  const handleSortOrderChange = (currentIndex: number, newSortOrder: number) => {
    if (newSortOrder >= 0 && newSortOrder < batchSortMenus.length) {
      setBatchSortMenus(items => {
        const newItems = [...items]
        const [movedItem] = newItems.splice(currentIndex, 1)
        newItems.splice(newSortOrder, 0, movedItem)
        return newItems
      })
    }
  }

  // 导出菜单配置
  const handleExportMenus = () => {
    const exportData = menus.map(menu => ({
      name: menu.name,
      title: menu.title,
      path: menu.path,
      component: menu.component,
      icon: menu.icon,
      parent_id: menu.parent_id,
      sort_order: menu.sort_order,
      is_hidden: menu.is_hidden,
      is_disabled: menu.is_disabled,
      menu_type: menu.menu_type,
      permission_code: menu.permission_code,
      redirect: menu.redirect,
      meta: menu.meta,
    }))

    const dataStr = JSON.stringify(exportData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `menu-config-${new Date().toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
    message.success('菜单配置导出成功')
  }

  // 导入菜单配置
  const handleImportMenus = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async e => {
      try {
        const importData = JSON.parse(e.target?.result as string)

        if (!Array.isArray(importData)) {
          message.error('导入文件格式错误')
          return
        }

        // 这里可以添加批量创建菜单的逻辑
        // 为了简化，这里只是显示导入的数据
        console.log('导入的菜单数据:', importData)
        message.success(`准备导入 ${importData.length} 个菜单项`)

        // 实际项目中，这里应该调用批量创建菜单的API
        // await api.post('/menu/menus/batch-import', { menus: importData });
        // loadMenus();
      } catch (error) {
        message.error('导入文件解析失败，请检查文件格式')
      }
    }
    reader.readAsText(file)

    // 清空input值，允许重复选择同一文件
    event.target.value = ''
  }

  const loadMenus = async () => {
    try {
      setLoading(true)
      const response = await api.get('/menu/menus')
      if (response.data) {
        setMenus(response.data)
        buildTreeData(response.data)
      }
    } catch (error) {
      message.error('加载菜单失败')
    } finally {
      setLoading(false)
    }
  }

  const buildTreeData = (menuList: Menu[]): void => {
    const menuMap = new Map<number, Menu>()
    menuList.forEach(menu => menuMap.set(menu.id, menu))

    const buildNode = (menu: Menu): TreeDataNode => ({
      key: menu.id,
      title: (
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            {menu.icon && <span className={`anticon anticon-${menu.icon}`} />}
            <span className="font-medium">{menu.title}</span>
            <span className="text-gray-400 text-xs">({menu.name})</span>
            <Tag color={menu.menu_type === 'menu' ? 'blue' : menu.menu_type === 'button' ? 'green' : 'orange'}>
              {menu.menu_type === 'menu' ? '菜单' : menu.menu_type === 'button' ? '按钮' : '页面'}
            </Tag>
            {menu.is_hidden && <Tag color="red">隐藏</Tag>}
            {menu.is_disabled && <Tag color="gray">禁用</Tag>}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {menu.path && <span>路径: {menu.path}</span>}
              <span>排序: {menu.sort_order}</span>
            </div>
            <Space>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={e => {
                  e.stopPropagation()
                  handleEditMenu(menu)
                }}
                title="编辑菜单"
              />
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={e => {
                  e.stopPropagation()
                  handleCopyMenu(menu)
                }}
                title="复制菜单"
              />
              {!menu.is_system && (
                <Popconfirm
                  title="确定删除此菜单吗？"
                  onConfirm={e => {
                    e?.stopPropagation()
                    handleDeleteMenu(menu.id)
                  }}
                  onClick={e => e?.stopPropagation()}
                >
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={e => e.stopPropagation()}
                  />
                </Popconfirm>
              )}
            </Space>
          </div>
        </div>
      ),
      children: menuList
        .filter(child => child.parent_id === menu.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(child => buildNode(child)),
    })

    const rootMenus = menuList
      .filter(menu => !menu.parent_id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(menu => buildNode(menu))

    setTreeData(rootMenus)
  }

  const handleCreateMenu = () => {
    setEditingMenu(null)
    menuForm.resetFields()
    setIconPreview('')
    setMenuModalVisible(true)
  }

  const handleCopyMenu = (menu: Menu) => {
    const copiedMenu = {
      ...menu,
      name: `${menu.name}_copy`,
      title: `${menu.title}(副本)`,
      sort_order: menu.sort_order + 1,
    }
    delete (copiedMenu as any).id
    delete (copiedMenu as any).created_at
    delete (copiedMenu as any).updated_at

    setEditingMenu(null)
    menuForm.setFieldsValue(copiedMenu)
    setIconPreview(menu.icon || '')
    setMenuModalVisible(true)
  }

  const handleEditMenu = (menu: Menu) => {
    setEditingMenu(menu)
    let metaValue = ''
    if (menu.meta) {
      try {
        // 如果meta已经是JSON字符串，则格式化显示
        metaValue = JSON.stringify(JSON.parse(menu.meta), null, 2)
      } catch (error) {
        // 如果meta不是有效的JSON，则直接显示原始值
        metaValue = menu.meta
      }
    }
    menuForm.setFieldsValue({
      ...menu,
      meta: metaValue,
    })
    setIconPreview(menu.icon || '')
    setMenuModalVisible(true)
  }

  const handleDeleteMenu = async (menuId: number) => {
    try {
      const response = await api.delete(`/menu/menus/${menuId}`)
      if (response.data.success) {
        message.success('删除成功')
        loadMenus()
      } else {
        message.error(response.data.message || '删除失败')
      }
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleMenuSubmit = async () => {
    try {
      const values = await menuForm.validateFields()
      let metaValue: string | undefined = undefined
      if (values.meta) {
        try {
          // 尝试解析并重新格式化JSON
          metaValue = JSON.stringify(JSON.parse(values.meta))
        } catch (error) {
          // 如果不是有效的JSON，则直接使用原始值
          metaValue = values.meta
        }
      }
      const formData: MenuFormData = {
        ...values,
        meta: metaValue,
      }

      let response
      if (editingMenu) {
        response = await api.put(`/menu/menus/${editingMenu.id}`, formData)
      } else {
        response = await api.post('/menu/menus', formData)
      }

      if (response.data.success) {
        message.success(editingMenu ? '更新成功' : '创建成功')
        setMenuModalVisible(false)
        loadMenus()
      } else {
        message.error(response.data.message || '操作失败')
      }
    } catch (error) {
      message.error('操作失败')
    }
  }

  // ===== 放到组件文件顶部或组件内（与 Menu 类型共存）=====
  const STEP = 10 // sort_order 步长

  // 判断 candidate 是否在 ancestor 的子树中（用于防环）
  const isInSubtree = (all: Menu[], ancestorId: number, candidateId: number | null | undefined) => {
    if (candidateId == null) return false
    const map = new Map(all.map(m => [m.id, m]))
    let cur = map.get(candidateId)
    while (cur) {
      if (cur.parent_id === ancestorId) return true // 找到祖先
      if (cur.parent_id == null) break
      cur = map.get(cur.parent_id)
    }
    return false
  }

  // 生成同层排序更新（只更新这个层级，量小）
  const buildLayerUpdates = (layer: Menu[], draggedId: number, forcedParent: number | null) =>
    layer.map((m, i) => ({
      id: m.id,
      parent_id: m.id === draggedId ? forcedParent : m.parent_id ?? null,
      sort_order: i * STEP,
    }))

  // ====== 替换 Tree 的 onDrop 回调 ======
  const handleTreeDrop: any = async (info: any) => {
    const { dragNode, node, dropPosition, dropToGap } = info
    if (!dragNode || !node) return

    const draggedId = Number(dragNode.key)
    const targetId = Number(node.key)

    const map = new Map(menus.map(m => [m.id, m]))
    const dragged = map.get(draggedId)!
    const target = map.get(targetId)!

    // 1) 计算新父级
    // - dropToGap=true   → 同层：parent = 目标的 parent
    // - dropToGap=false  → 成为目标子级：parent = 目标 id
    const newParentId: number | null = dropToGap ? target.parent_id ?? null : target.id

    // 2) 防止拖到自己的子孙里（形成环）
    if (isInSubtree(menus, draggedId, newParentId)) {
      message.warning('不能把菜单拖到自己的子级里')
      return
    }

    // 3) 取新父级下的同层兄弟（不含自身），按 sort_order 排序
    const siblings = menus
      .filter(m => (m.parent_id ?? null) === (newParentId ?? null) && m.id !== dragged.id)
      .sort((a, b) => a.sort_order - b.sort_order)

    // 4) 计算插入位置
    let insertIdx = 0
    if (dropToGap) {
      const targetIdx = siblings.findIndex(s => s.id === target.id)
      insertIdx = dropPosition < 0 ? targetIdx : targetIdx + 1 // 目标前/后
    } else {
      insertIdx = siblings.length // 作为子节点放末尾
    }

    // 5) 把拖拽项插入到同层数组中
    const nextLayer: Menu[] = [...siblings]
    nextLayer.splice(insertIdx, 0, { ...dragged, parent_id: newParentId ?? undefined })

    // 6) 生成最小化批量更新 payload（仅新父级这层）
    const menuUpdates = buildLayerUpdates(nextLayer, dragged.id, newParentId)

    try {
      await api.post('/menu/menus/batch-sort', { menuUpdates })
      message.success('菜单结构已更新')
      loadMenus()
    } catch (e: any) {
      message.error(e?.message || '更新失败')
    }
  }


    
  const renderMenuTab = () => (
    <Card
      title="菜单管理"
      extra={
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateMenu}>
            新增菜单
          </Button>
          <Button
            icon={<DragOutlined />}
            onClick={() => {
              setBatchSortMenus([...menus].sort((a, b) => a.sort_order - b.sort_order))
              setBatchSortVisible(true)
            }}
          >
            批量排序
          </Button>
          <Button icon={<ExportOutlined />} onClick={handleExportMenus}>
            导出配置
          </Button>
          <Button
            icon={<ImportOutlined />}
            onClick={() => {
              const input = document.createElement('input')
              input.type = 'file'
              input.accept = '.json'
              input.onchange = handleImportMenus
              input.click()
            }}
          >
            导入配置
          </Button>
        </Space>
      }
    >
      <Tree
        treeData={treeData}
        defaultExpandAll
        showLine
        loading={loading}
        draggable
        blockNode
        onDragStart={info => {
          setDraggedNode(info.node)
        }}
        onDrop={handleTreeDrop}
      />
    </Card>
  )

  return (
    <div className="p-6">
      {renderMenuTab()}

      {/* 菜单编辑模态框 */}
      <Modal
        title={editingMenu ? '编辑菜单' : '新增菜单'}
        open={menuModalVisible}
        onOk={handleMenuSubmit}
        onCancel={() => {
          setMenuModalVisible(false)
          setIconPreview('')
        }}
        width={800}
        destroyOnHidden
        forceRender
      >
        <Form form={menuForm} layout="vertical">
          <Form.Item name="name" label="菜单名称" rules={[{ required: true, message: '请输入菜单名称' }]}>
            <Input placeholder="请输入菜单名称" />
          </Form.Item>

          <Form.Item name="title" label="菜单标题" rules={[{ required: true, message: '请输入菜单标题' }]}>
            <Input placeholder="请输入菜单标题" />
          </Form.Item>

          <Form.Item name="path" label="路由路径">
            <Input placeholder="请输入路由路径" />
          </Form.Item>

          <Form.Item name="component" label="组件路径">
            <Input placeholder="请输入组件路径" />
          </Form.Item>

          <Form.Item name="icon" label="图标">
            <Input
              placeholder="请输入图标类名（如：user, setting, dashboard）"
              addonBefore={iconPreview ? <span className={`anticon anticon-${iconPreview}`} /> : <span>图标</span>}
              onChange={e => setIconPreview(e.target.value)}
            />
          </Form.Item>

          <Form.Item name="parent_id" label="父级菜单">
            <Select placeholder="请选择父级菜单" allowClear>
              {menus
                .filter(menu => menu.menu_type === 'menu')
                .map(menu => (
                  <Select.Option key={menu.id} value={menu.id}>
                    {menu.title}
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="menu_type"
            label="菜单类型"
            rules={[{ required: true, message: '请选择菜单类型' }]}
            initialValue="menu"
          >
            <Select>
              <Select.Option value="menu">菜单</Select.Option>
              <Select.Option value="button">按钮</Select.Option>
              <Select.Option value="page">页面</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="sort_order" label="排序号" tooltip="数值越小排序越靠前，留空将自动设置为最大排序号+1">
            <Input type="number" placeholder="留空自动排序" min={0} step={1} />
          </Form.Item>

          <Form.Item name="permission_code" label="权限编码">
            <Input placeholder="请输入权限编码" />
          </Form.Item>

          <Form.Item name="redirect" label="重定向路径">
            <Input placeholder="请输入重定向路径" />
          </Form.Item>

          <Form.Item name="meta" label="元数据(JSON)">
            <Input.TextArea rows={3} placeholder="请输入JSON格式的元数据" />
          </Form.Item>

          <Form.Item name="is_hidden" valuePropName="checked" initialValue={false}>
            <Switch checkedChildren="隐藏" unCheckedChildren="显示" />
          </Form.Item>

          <Form.Item name="is_disabled" valuePropName="checked" initialValue={false}>
            <Switch checkedChildren="禁用" unCheckedChildren="启用" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量排序模态框 */}
      <Modal
        title="批量调整菜单排序"
        open={batchSortVisible}
        onOk={async () => {
          try {
            // 使用新的批量更新API
            const menuUpdates = batchSortMenus.map((menu, index) => ({
              id: menu.id,
              sort_order: index,
            }))

            const response = await api.post('/menu/menus/batch-sort', {
              menuUpdates,
            })

            if (response.data) {
              message.success('批量排序更新成功')
              setBatchSortVisible(false)
              loadMenus()
            } else {
              message.error(response.data.message || '批量排序更新失败')
            }
          } catch (error) {
            message.error('批量排序更新失败')
          }
        }}
        onCancel={() => setBatchSortVisible(false)}
        width={800}
        destroyOnHidden
      >
        <div className="space-y-2">
          <p className="text-gray-600 mb-4">拖拽下方列表项来调整菜单排序，或直接修改排序号：</p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={batchSortMenus.map(menu => menu.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {batchSortMenus.map((menu, index) => (
                  <SortableMenuItem key={menu.id} menu={menu} index={index} onSortOrderChange={handleSortOrderChange} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </Modal>
    </div>
  )
}

export default MenuManagementPage
