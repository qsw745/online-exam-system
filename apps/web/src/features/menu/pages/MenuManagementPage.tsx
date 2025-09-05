// apps/web/src/features/menu/pages/MenuManagementPage.tsx
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

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { menuApi, type MenuDTO } from '@shared/api/endpoints/menu'
import {
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Tag,
  Tree,
  Typography,
  type TreeProps,
} from 'antd'
import type { DataNode, EventDataNode } from 'antd/es/tree'
import React, { useEffect, useMemo, useState } from 'react'

/** 前端表单模型 */
interface MenuFormData {
  name: string
  title: string
  path?: string
  component?: string
  icon?: string
  parent_id?: number | null
  sort_order?: number
  is_hidden?: boolean
  is_disabled?: boolean
  menu_type: 'menu' | 'button' | 'page'
  permission_code?: string
  redirect?: string
  meta?: string
}

/** 可拖拽列表项（批量排序对话框里用） */
interface SortableMenuItemProps {
  menu: MenuDTO
  index: number
  onSortOrderChange: (index: number, newIndex: number) => void
}

const SortableMenuItem: React.FC<SortableMenuItemProps> = ({ menu, index, onSortOrderChange }) => {
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

  const handleChange = (value: number | null) => {
    if (typeof value === 'number') onSortOrderChange(index, value)
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
          <InputNumber size="small" value={index} min={0} onChange={handleChange} />
        </div>
      </div>
    </div>
  )
}

const STEP = 10 // sort_order 步长，用于层内重排

const MenuManagementPage: React.FC = () => {
  const { message } = App.useApp()

  const [menus, setMenus] = useState<MenuDTO[]>([])
  const [treeData, setTreeData] = useState<DataNode[]>([])
  const [loading, setLoading] = useState<boolean>(false)

  const [menuModalVisible, setMenuModalVisible] = useState<boolean>(false)
  const [editingMenu, setEditingMenu] = useState<MenuDTO | null>(null)
  const [menuForm] = Form.useForm<MenuFormData>()

  const [iconPreview, setIconPreview] = useState<string>('')
  const [draggedNode, setDraggedNode] = useState<EventDataNode<DataNode> | null>(null)

  const [batchSortVisible, setBatchSortVisible] = useState<boolean>(false)
  const [batchSortMenus, setBatchSortMenus] = useState<MenuDTO[]>([])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  /** 构建树节点 */
  const buildTreeData = (menuList: MenuDTO[]): DataNode[] => {
    const byParent = new Map<number | null, MenuDTO[]>()
    for (const m of menuList) {
      const pid = m.parent_id ?? null
      const arr = byParent.get(pid) ?? []
      arr.push(m)
      byParent.set(pid, arr)
    }
    const sortAsc = (a: MenuDTO, b: MenuDTO) => a.sort_order - b.sort_order

    const makeNodes = (pid: number | null): DataNode[] =>
      (byParent.get(pid) ?? []).sort(sortAsc).map((m: MenuDTO) => ({
        key: m.id,
        title: (
          <div
            className="flex items-center justify-between w-full"
            style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}
          >
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6b7280', fontSize: 12 }}>
                {m.path && <span>路径: {m.path}</span>}
                <span>排序: {m.sort_order}</span>
              </div>
              <Space>
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                    e.stopPropagation()
                    handleEditMenu(m)
                  }}
                  title="编辑菜单"
                />
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                    e.stopPropagation()
                    handleCopyMenu(m)
                  }}
                  title="复制菜单"
                />
                {!m.is_system && (
                  <Popconfirm
                    title="确定删除此菜单吗？"
                    onConfirm={(e?: React.MouseEvent<HTMLElement>) => {
                      e?.stopPropagation?.()
                      handleDeleteMenu(m.id)
                    }}
                    onClick={(e?: React.MouseEvent<HTMLElement>) => e?.stopPropagation?.()}
                  >
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => e.stopPropagation()}
                    />
                  </Popconfirm>
                )}
              </Space>
            </div>
          </div>
        ),
        children: makeNodes(m.id),
      }))

    return makeNodes(null)
  }

  /** 加载菜单 */
  const loadMenus = async () => {
    try {
      setLoading(true)
      const list = await menuApi.list()
      setMenus(list)
      setTreeData(buildTreeData(list))
    } catch (err) {
      message.error('加载菜单失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadMenus()
  }, [])

  /** 新建 */
  const handleCreateMenu = () => {
    setEditingMenu(null)
    menuForm.resetFields()
    setIconPreview('')
    setMenuModalVisible(true)
  }

  /** 复制 */
  const handleCopyMenu = (menu: MenuDTO) => {
    const copied: Partial<MenuFormData> = {
      name: `${menu.name}_copy`,
      title: `${menu.title}(副本)`,
      path: menu.path,
      component: menu.component,
      icon: menu.icon,
      parent_id: menu.parent_id ?? null,
      sort_order: (menu.sort_order ?? 0) + 1,
      is_hidden: menu.is_hidden,
      is_disabled: menu.is_disabled,
      menu_type: menu.menu_type,
      permission_code: menu.permission_code,
      redirect: menu.redirect,
      meta: menu.meta,
    }
    setEditingMenu(null)
    menuForm.setFieldsValue(copied as MenuFormData)
    setIconPreview(menu.icon || '')
    setMenuModalVisible(true)
  }

  /** 编辑 */
  const handleEditMenu = (menu: MenuDTO) => {
    setEditingMenu(menu)
    let metaValue = ''
    if (menu.meta) {
      try {
        metaValue = JSON.stringify(JSON.parse(menu.meta), null, 2)
      } catch {
        metaValue = menu.meta
      }
    }
    menuForm.setFieldsValue({ ...menu, meta: metaValue } as MenuFormData)
    setIconPreview(menu.icon || '')
    setMenuModalVisible(true)
  }

  /** 删除 */
  const handleDeleteMenu = async (menuId: number) => {
    try {
      const ret = await menuApi.remove(menuId)
      const ok = (ret as any)?.success !== false // 容忍不带 success 的纯 200
      if (ok) {
        message.success('删除成功')
        void loadMenus()
      } else {
        message.error((ret as any)?.message || '删除失败')
      }
    } catch {
      message.error('删除失败')
    }
  }

  /** 提交（新建/编辑） */
  const handleMenuSubmit = async () => {
    try {
      const values = await menuForm.validateFields()
      const formData: MenuFormData = { ...values }

      if (formData.meta) {
        try {
          formData.meta = JSON.stringify(JSON.parse(formData.meta))
        } catch {
          // keep original
        }
      }

      const ret = editingMenu ? await menuApi.update(editingMenu.id, formData) : await menuApi.create(formData)

      const ok = (ret as any)?.success !== false
      if (ok) {
        message.success(editingMenu ? '更新成功' : '创建成功')
        setMenuModalVisible(false)
        void loadMenus()
      } else {
        message.error((ret as any)?.message || '操作失败')
      }
    } catch {
      message.error('操作失败')
    }
  }

  /** ========== 树拖拽：仅在同层维护排序 & 支持换父级 ========== */

  const isInSubtree = (all: MenuDTO[], ancestorId: number, candidateId: number | null | undefined) => {
    if (candidateId == null) return false
    const map = new Map<number, MenuDTO>(all.map((m: MenuDTO) => [m.id, m]))
    let cur: MenuDTO | undefined = map.get(candidateId)
    while (cur) {
      if ((cur.parent_id ?? null) === ancestorId) return true
      if (cur.parent_id == null) break
      cur = map.get(cur.parent_id)
    }
    return false
  }

  const buildLayerUpdates = (layer: MenuDTO[], draggedId: number, forcedParent: number | null) =>
    layer.map((m: MenuDTO, i: number) => ({
      id: m.id,
      parent_id: m.id === draggedId ? forcedParent : m.parent_id ?? null,
      sort_order: i * STEP,
    }))

  const handleTreeDrop: TreeProps['onDrop'] = async info => {
    const { dragNode, node, dropPosition, dropToGap } = info
    if (!dragNode || !node) return

    const draggedId = Number(dragNode.key)
    const targetId = Number(node.key)

    const map = new Map<number, MenuDTO>(menus.map((m: MenuDTO) => [m.id, m]))
    const dragged = map.get(draggedId)
    const target = map.get(targetId)
    if (!dragged || !target) return

    const newParentId: number | null = dropToGap ? target.parent_id ?? null : target.id

    if (isInSubtree(menus, draggedId, newParentId)) {
      message.warning('不能把菜单拖到自己的子级里')
      return
    }

    const siblings = menus
      .filter((m: MenuDTO) => (m.parent_id ?? null) === (newParentId ?? null) && m.id !== dragged.id)
      .sort((a: MenuDTO, b: MenuDTO) => a.sort_order - b.sort_order)

    let insertIdx = 0
    if (dropToGap) {
      const targetIdx = siblings.findIndex((s: MenuDTO) => s.id === target.id)
      insertIdx = dropPosition && dropPosition < 0 ? targetIdx : targetIdx + 1
    } else {
      insertIdx = siblings.length
    }

    const nextLayer: MenuDTO[] = [...siblings]
    nextLayer.splice(insertIdx, 0, { ...dragged, parent_id: newParentId })

    const menuUpdates = buildLayerUpdates(nextLayer, dragged.id, newParentId)

    try {
      const ret = await menuApi.batchSort(menuUpdates)
      const ok = (ret as any)?.success !== false
      if (ok) {
        message.success('菜单结构已更新')
        void loadMenus()
      } else {
        message.error((ret as any)?.message || '更新失败')
      }
    } catch (e: unknown) {
      const err = e as { message?: string }
      message.error(err?.message || '更新失败')
    }
  }

  /** ===== 批量排序对话框 —— DnD 列表 ===== */
  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setBatchSortMenus((items: MenuDTO[]) => {
      const oldIndex = items.findIndex((x: MenuDTO) => x.id === active.id)
      const newIndex = items.findIndex((x: MenuDTO) => x.id === over.id)
      return arrayMove(items, oldIndex, newIndex)
    })
  }

  const parentMenuOptions = useMemo(
    () => menus.filter((m: MenuDTO) => m.menu_type === 'menu').map((m: MenuDTO) => ({ label: m.title, value: m.id })),
    [menus]
  )

  return (
    <div style={{ padding: 24 }}>
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
                setBatchSortMenus([...menus].sort((a: MenuDTO, b: MenuDTO) => a.sort_order - b.sort_order))
                setBatchSortVisible(true)
              }}
            >
              批量排序
            </Button>
            <Button
              icon={<ExportOutlined />}
              onClick={() => {
                const exportData = menus.map((menu: MenuDTO) => ({
                  name: menu.name,
                  title: menu.title,
                  path: menu.path,
                  component: menu.component,
                  icon: menu.icon,
                  parent_id: menu.parent_id ?? null,
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
              }}
            >
              导出配置
            </Button>
            <Button
              icon={<ImportOutlined />}
              onClick={() => {
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = '.json'
                input.onchange = (event: Event) => {
                  const target = event.target as HTMLInputElement
                  const file = target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = async (e: ProgressEvent<FileReader>) => {
                    try {
                      const text = String(e.target?.result || '')
                      const importData: unknown = JSON.parse(text)
                      if (!Array.isArray(importData)) {
                        message.error('导入文件格式错误')
                        return
                      }
                      // 仅提示
                      message.success(`准备导入 ${importData.length} 个菜单项`)
                      // TODO: 调用批量创建接口
                      // await menuApi.batchCreate(importData as MenuFormData[])
                      // await loadMenus()
                    } catch {
                      message.error('导入文件解析失败，请检查文件格式')
                    }
                  }
                  reader.readAsText(file)
                  target.value = ''
                }
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
          draggable
          blockNode
          loading={loading as unknown as boolean}
          onDragStart={(info: Parameters<NonNullable<TreeProps['onDragStart']>>[0]) => setDraggedNode(info.node)}
          onDrop={handleTreeDrop}
        />
      </Card>

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
        <Form<MenuFormData>
          form={menuForm}
          layout="vertical"
          initialValues={{ menu_type: 'menu', is_hidden: false, is_disabled: false }}
        >
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIconPreview(e.target.value)}
            />
          </Form.Item>

          <Form.Item name="parent_id" label="父级菜单">
            <Select placeholder="请选择父级菜单" allowClear options={parentMenuOptions} />
          </Form.Item>

          <Form.Item name="menu_type" label="菜单类型" rules={[{ required: true, message: '请选择菜单类型' }]}>
            <Select
              options={[
                { value: 'menu', label: '菜单' },
                { value: 'button', label: '按钮' },
                { value: 'page', label: '页面' },
              ]}
            />
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

          <Form.Item name="is_hidden" valuePropName="checked">
            <Switch checkedChildren="隐藏" unCheckedChildren="显示" />
          </Form.Item>

          <Form.Item name="is_disabled" valuePropName="checked">
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
            const menuUpdates = batchSortMenus.map((m: MenuDTO, index: number) => ({
              id: m.id,
              sort_order: index * STEP,
            }))
            const ret = await menuApi.batchSort(menuUpdates)
            const ok = (ret as any)?.success !== false
            if (ok) {
              message.success('批量排序更新成功')
              setBatchSortVisible(false)
              void loadMenus()
            } else {
              message.error((ret as any)?.message || '批量排序更新失败')
            }
          } catch {
            message.error('批量排序更新失败')
          }
        }}
        onCancel={() => setBatchSortVisible(false)}
        width={800}
        destroyOnHidden
      >
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Typography.Paragraph style={{ color: '#4b5563', marginBottom: 0 }}>
            拖拽下方列表项来调整菜单排序，或直接修改“当前位置”：
          </Typography.Paragraph>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={batchSortMenus.map((m: MenuDTO) => m.id)} strategy={verticalListSortingStrategy}>
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                {batchSortMenus.map((menu: MenuDTO, index: number) => (
                  <SortableMenuItem
                    key={menu.id}
                    menu={menu}
                    index={index}
                    onSortOrderChange={(from: number, to: number) => {
                      if (to < 0 || to >= batchSortMenus.length) return
                      setBatchSortMenus((items: MenuDTO[]) => {
                        const copy = [...items]
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
    </div>
  )
}

export default MenuManagementPage
