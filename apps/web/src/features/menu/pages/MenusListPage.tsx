import { menuApi, type MenuCreateInput, type MenuDTO, type MenuUpdateInput } from '@/shared/api/endpoints/menu'
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  ColumnHeightOutlined,
  CompressOutlined,
  DownOutlined,
  ExpandOutlined,
  HolderOutlined,
  PlusOutlined,
  RedoOutlined,
  ReloadOutlined,
  RightOutlined,
  SearchOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  Checkbox,
  Dropdown,
  Form,
  Input,
  InputNumber,
  MenuProps,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from '@/shared/utils/dayjs'
import { useLanguage } from '@/shared/contexts/LanguageContext'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatDateTime } from '@/shared/utils/datetime'

/** 后端真实类型用于筛选等 */
type Query = { keyword?: string; type?: MenuDTO['menu_type'] }
/** 前端专用的编辑类型（支持 iframe） */
type UIType = 'menu' | 'iframe' | 'link' | 'button'
type TreeMenu = MenuDTO & { children?: TreeMenu[] }

/** ===================== 公共工具栏 ===================== */
type ToolbarProps = {
  onCreate: () => void
  expanded: boolean
  onToggleExpand: () => void
  onRefresh: () => void
  size: 'large' | 'middle' | 'small'
  onSizeChange: (s: 'large' | 'middle' | 'small') => void
  columnSettingPanel: React.ReactNode
  full: boolean
  onToggleFull: () => void
}
function TableToolbar({
  onCreate,
  expanded,
  onToggleExpand,
  onRefresh,
  size,
  onSizeChange,
  columnSettingPanel,
  full,
  onToggleFull,
}: ToolbarProps) {
  const { t } = useLanguage()
  const densityMenu: MenuProps['items'] = [
    { key: 'large', label: t('table.density.loose'), onClick: () => onSizeChange('large') },
    { key: 'middle', label: t('table.density.default'), onClick: () => onSizeChange('middle') },
    { key: 'small', label: t('table.density.compact'), onClick: () => onSizeChange('small') },
  ]
  const densityLabel = size === 'large' ? t('table.density.loose') : size === 'small' ? t('table.density.compact') : t('table.density.default')
  return (
    <Space>
      <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
        {t('menuList.add_menu')}
      </Button>

      {/* 展开/折叠：单按钮图标切换 */}
      <Tooltip title={expanded ? t('table.toolbar.collapse_all') : t('table.toolbar.expand_all')}>
        <Button icon={expanded ? <DownOutlined /> : <RightOutlined />} onClick={onToggleExpand} />
      </Tooltip>

      <Tooltip title={t('app.refresh')}>
        <Button icon={<ReloadOutlined />} onClick={onRefresh} />
      </Tooltip>

      <Dropdown menu={{ items: densityMenu }}>
        <Tooltip title={`${t('table.toolbar.density')}: ${densityLabel}`}>
          <Button icon={<ColumnHeightOutlined />} />
        </Tooltip>
      </Dropdown>

      {/* v5.19 用 dropdownRender（没有 popupRender） */}
      <Dropdown dropdownRender={() => columnSettingPanel} trigger={['click']}>
        <Tooltip title={t('table.toolbar.column_settings')}>
          <Button icon={<SettingOutlined />} />
        </Tooltip>
      </Dropdown>

      <Tooltip title={full ? t('table.toolbar.exit_fullscreen') : t('table.toolbar.fullscreen')}>
        <Button icon={full ? <CompressOutlined /> : <ExpandOutlined />} onClick={onToggleFull} />
      </Tooltip>
    </Space>
  )
}

/** ===================== 组件主体 ===================== */
function TypeTag({ type }: { type: MenuDTO['menu_type'] }) {
  const { t } = useLanguage()
  const map: Record<string, string> = {
    menu: t('menuList.type.menu'),
    link: t('menuList.type.link'),
    button: t('menuList.type.button'),
    iframe: 'iframe',
    dir: t('menuList.type.dir'),
  } as any
  return <Tag>{map[type] ?? type}</Tag>
}

/** 扁平 -> 树 */
function buildTree(rows: MenuDTO[]): TreeMenu[] {
  const map = new Map<number, TreeMenu>()
  rows.forEach(r => map.set(r.id, { ...(r as MenuDTO), children: [] }))
  const roots: TreeMenu[] = []
  for (const m of map.values()) {
    const pid = m.parent_id ?? null
    if (pid == null || !map.has(pid)) roots.push(m)
    else map.get(pid)!.children!.push(m)
  }
  const sortSiblings = (ns: TreeMenu[]) => {
    ns.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id)
    ns.forEach(n => n.children && sortSiblings(n.children))
  }
  sortSiblings(roots)
  return roots
}

/** 过滤树（命中或包含命中子孙就保留） */
function filterTree(tree: TreeMenu[], pred: (x: MenuDTO) => boolean): TreeMenu[] {
  const dfs = (node: TreeMenu): TreeMenu | null => {
    const keptChildren = (node.children || []).map(dfs).filter(Boolean) as TreeMenu[]
    if (pred(node) || keptChildren.length) return { ...node, children: keptChildren }
    return null
  }
  return tree.map(dfs).filter(Boolean) as TreeMenu[]
}

/** 收集全部 key（展开全部） */
function collectKeys(tree: TreeMenu[]): React.Key[] {
  const out: React.Key[] = []
  const walk = (ns: TreeMenu[]) => {
    for (const n of ns) {
      out.push(n.id)
      if (n.children?.length) walk(n.children)
    }
  }
  walk(tree)
  return out
}

export default function MenusListPage() {
  const { message } = App.useApp()
  const { t } = useLanguage()

  /** 搜索表单（常驻） */
  const [searchForm] = Form.useForm<Query>()
  const kwWatch = Form.useWatch('keyword', searchForm)
  const typeWatch = Form.useWatch('type', searchForm)

  const [flat, setFlat] = useState<MenuDTO[]>([])
  const [loading, setLoading] = useState(false)

  // 展开、密度、列控制
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([])
  const [size, setSize] = useState<'large' | 'middle' | 'small'>('middle')
  const allColumnKeys = [
    'title',
    'menu_type',
    'path',
    'component',
    'permission_code',
    'sort_order',
    'updated_at',
    'actions',
  ] as const
  type ColKey = (typeof allColumnKeys)[number]

  // 维护列顺序与可见性
  const [orderCols, setOrderCols] = useState<ColKey[]>([...allColumnKeys])
  const DEFAULT_COLS = [...allColumnKeys]
  const [visibleCols, setVisibleCols] = useState<ColKey[]>([...DEFAULT_COLS])

  // 局部全屏（用 Portal）
  const [full, setFull] = useState(false)
  useEffect(() => {
    if (!full) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [full])

  // 编辑弹窗
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorType, setEditorType] = useState<UIType>('menu')
  const [editorForm] = Form.useForm()
  const editorInitRef = useRef<any>(null)

  // ------- 数据 -------
  const fetchData = async () => {
    setLoading(true)
    try {
      const list = await menuApi.list({ scope: 'system' })
      setFlat(list || [])
    } catch {
      message.error(t('menuList.messages.load_failed'))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void fetchData()
  }, [])

  const baseTree = useMemo(() => buildTree(flat), [flat])
  const tree = useMemo(() => {
    const kw = (kwWatch || '').trim().toLowerCase()
    const type = typeWatch
    const match = (x: MenuDTO) => {
      if (type && x.menu_type !== type) return false
      if (!kw) return true
      const hay = [x.title, x.name, x.path, x.component, x.permission_code].join(' ').toLowerCase()
      return hay.includes(kw)
    }
    return filterTree(baseTree, match)
  }, [baseTree, kwWatch, typeWatch])

  const expandAll = () => setExpandedRowKeys([...collectKeys(tree)])
  const collapseAll = () => setExpandedRowKeys([])

  // ------- 弹窗 -------
  const openEditor = (init?: Partial<MenuDTO>) => {
    const initial: Partial<
      MenuDTO & { keep_alive?: boolean; affix?: boolean; iframe_src?: string; external?: boolean }
    > = {
      id: init?.id,
      parent_id: init?.parent_id ?? null,
      title: init?.title,
      name: init?.name,
      path: init?.path,
      component: init?.component,
      icon: init?.icon,
      redirect: init?.redirect,
      permission_code: init?.permission_code,
      menu_type: (init?.menu_type as any) ?? 'menu',
      sort_order: init?.sort_order ?? 99,
      is_hidden: init?.is_hidden ?? false,
      is_disabled: init?.is_disabled ?? false,
      keep_alive: (init as any)?.keep_alive ?? false,
      affix: (init as any)?.affix ?? false,
      iframe_src: (init as any)?.iframe_src ?? '',
      external: (init as any)?.external ?? false,
    }
    const mapped: UIType =
      (initial.menu_type as UIType) && ['menu', 'iframe', 'link', 'button'].includes(initial.menu_type as string)
        ? (initial.menu_type as UIType)
        : 'menu'

    editorInitRef.current = { ...initial, menu_type: mapped }
    setEditorType(mapped)
    setEditorOpen(true)
  }
  const closeEditor = () => setEditorOpen(false)

  const handleSave = async () => {
    const v = await editorForm.validateFields()
    const uiType = (v.menu_type as UIType) || 'menu'
    const backendType = (uiType === 'iframe' ? 'menu' : uiType) as MenuDTO['menu_type']

    let payload: Partial<Omit<MenuCreateInput & MenuUpdateInput, 'id'>> = {
      parent_id: v.parent_id ?? null,
      title: v.title,
      sort_order: v.sort_order ?? 99,
      icon: v.icon,
      menu_type: backendType,
      is_hidden: v.is_hidden,
      is_disabled: v.is_disabled,
    }

    if (uiType === 'menu') {
      payload = {
        ...payload,
        name: v.name,
        path: v.path,
        component: v.component,
        redirect: v.redirect,
        permission_code: v.permission_code,
      }
    } else if (uiType === 'iframe') {
      payload = {
        ...payload,
        name: v.name,
        path: v.path,
        component: v.component,
        redirect: v.iframe_src,
      }
    } else if (uiType === 'link') {
      payload = {
        ...payload,
        name: v.name,
        redirect: v.iframe_src,
      }
    } else if (uiType === 'button') {
      payload = {
        ...payload,
        permission_code: v.permission_code,
      }
    }

    try {
      if (v.id) await menuApi.update(v.id, payload as MenuUpdateInput, { scope: 'system' })
      else await menuApi.create(payload as MenuCreateInput, { scope: 'system' })
      message.success(t('menuList.messages.saved'))
      setEditorOpen(false)
      await fetchData()
    } catch {
      message.error(t('menuList.messages.save_failed'))
    }
  }

  const onCreate = () => openEditor()
  const onEdit = (row: MenuDTO) => openEditor(row)
  const onCreateChild = (row: MenuDTO) => openEditor({ parent_id: row.id })
  const onDelete = async (row: MenuDTO) => {
    try {
      await menuApi.remove(row.id, { scope: 'system' })
      message.success(t('menuList.messages.delete_success'))
      await fetchData()
    } catch (e: any) {
      message.error(e?.message || t('menuList.messages.delete_failed'))
    }
  }

  // —— 列设置（显隐 + 拖拽排序）
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  // 拖拽重排“全量顺序”
  const moveCol = (index: number, toIndex: number) => {
    setOrderCols(prev => {
      if (index === toIndex || index < 0 || toIndex < 0 || index >= prev.length || toIndex >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.splice(toIndex, 0, item)
      return next
    })
  }

  const onDragStart = (index: number) => setDragIndex(index)
  const onDragOver = (e: React.DragEvent) => e.preventDefault()
  const onDrop = (index: number) => {
    if (dragIndex === null) return
    moveCol(dragIndex, index)
    setDragIndex(null)
  }

  // 勾选切换：只改“显示集合”，不改顺序
  const toggleCol = (k: ColKey) => setVisibleCols(prev => (prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]))

  // —— 列定义（全量）
  const allColumns: Record<ColKey, any> = {
    title: {
      title: t('menuList.columns.title'),
      dataIndex: 'title',
      key: 'title',
      width: 260,
      ellipsis: true,
      onCell: () => ({
        style: { maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
      }),
      render: (v: any, r: TreeMenu) => (
        <Space size={6}>
          <span
            style={{
              display: 'inline-block',
              maxWidth: 220,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              verticalAlign: 'middle',
            }}
            title={v}
          >
            {v}
          </span>
          {r.is_hidden ? <Tag>{t('menuList.hidden')}</Tag> : null}
          {r.is_disabled ? <Tag color="red">{t('menuList.disabled')}</Tag> : null}
        </Space>
      ),
    },
    menu_type: { title: t('menuList.columns.menu_type'), dataIndex: 'menu_type', width: 100, render: (v: any) => <TypeTag type={v as any} /> },
    path: { title: t('menuList.columns.path'), dataIndex: 'path', width: 220, ellipsis: true },
    component: { title: t('menuList.columns.component'), dataIndex: 'component', width: 220, ellipsis: true },
    permission_code: { title: t('menuList.columns.permission_code'), dataIndex: 'permission_code', width: 180, ellipsis: true },
    sort_order: { title: t('menuList.columns.sort_order'), dataIndex: 'sort_order', width: 90 },
    updated_at: {
      title: t('menuList.columns.updated_at'),
      dataIndex: 'updated_at',
      width: 170,
      render: (v: any) => (v ? formatDateTime(v) : '-'),
    },
    actions: {
      title: t('menuList.columns.actions'),
      key: 'actions',
      fixed: 'right' as const,
      width: 220,
      onHeaderCell: () => ({ className: 'menus-fixed-white' }),
      onCell: () => ({ className: 'menus-fixed-white' }),
      render: (_: any, r: TreeMenu) => (
        <Space size="small">
          <Button type="link" onClick={() => onEdit(r)}>
            {t('app.edit')}
          </Button>
          <Button type="link" onClick={() => onCreateChild(r)}>
            {t('app.add')}
          </Button>
          <Popconfirm title={t('menuList.confirm_delete')} onConfirm={() => onDelete(r)}>
            <Button type="link" danger>
              {t('app.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  }

  // 最终列 = 先按 orderCols 排序，再过滤出 visibleCols
  const columns = useMemo<ColumnsType<TreeMenu>>(
    () =>
      orderCols
        .filter(k => visibleCols.includes(k))
        .map(k => allColumns[k])
        .filter(Boolean),
    [orderCols, visibleCols, t]
  )

  // 搜索
  const doSearch = () => setExpandedRowKeys([...collectKeys(tree)])
  const doReset = () => {
    searchForm.resetFields()
    setExpandedRowKeys([])
  }

  // —— 列设置浮层
  const allChecked = visibleCols.length === allColumnKeys.length
  const onToggleAll = (checked: boolean) => setVisibleCols(checked ? [...allColumnKeys] : [])
  const resetCols = () => {
    setOrderCols([...allColumnKeys])
    setVisibleCols([...allColumnKeys])
  }

  const labelMap: Record<ColKey, string> = {
    title: t('menuList.columns.title'),
    menu_type: t('menuList.columns.menu_type'),
    path: t('menuList.columns.path'),
    component: t('menuList.columns.component'),
    permission_code: t('menuList.columns.permission_code'),
    sort_order: t('menuList.columns.sort_order'),
    updated_at: t('menuList.columns.updated_at'),
    actions: t('menuList.columns.actions'),
  }

  const ColumnSetting = (
    <div
      style={{
        width: 320,
        background: '#fff',
        borderRadius: 8,
        boxShadow: '0 6px 18px rgba(0,0,0,.12)',
        border: '1px solid #edf2f7',
        overflow: 'hidden',
      }}
      onDragOver={onDragOver}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: '1px solid #f0f0f0',
          background: '#fff',
        }}
      >
        <Checkbox checked={allChecked} onChange={e => onToggleAll(e.target.checked)}>
          {t('table.columns.title')}
        </Checkbox>
        <Button type="link" size="small" onClick={resetCols} style={{ padding: 0 }}>
          {t('app.reset')}
        </Button>
      </div>

      <div style={{ padding: 10, background: '#fff' }}>
        {orderCols.map((k, idx) => {
          const checked = visibleCols.includes(k)
          return (
            <div
              key={k}
              draggable
              onDragStart={() => onDragStart(idx)}
              onDrop={() => onDrop(idx)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                borderRadius: 8,
                border: checked ? '1px solid #eef2f6' : '1px dashed #e5e7eb',
                marginBottom: 8,
                background: checked ? '#fff' : '#fafafa',
                cursor: 'move',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <HolderOutlined style={{ color: checked ? '#9aa4b2' : '#cbd5e1' }} />
                <Checkbox checked={checked} onChange={() => toggleCol(k)}>
                  <span style={{ color: checked ? '#3b82f6' : '#475569', fontWeight: checked ? 600 : 400 }}>
                    {labelMap[k]}
                  </span>
                </Checkbox>
              </div>
              <Space size={4}>
                <Button size="small" icon={<ArrowUpOutlined />} onClick={() => moveCol(idx, Math.max(0, idx - 1))} />
                <Button
                  size="small"
                  icon={<ArrowDownOutlined />}
                  onClick={() => moveCol(idx, Math.min(orderCols.length - 1, idx + 1))}
                />
              </Space>
            </div>
          )
        })}
      </div>
    </div>
  )

  // 是否“已展开”（用于工具栏图标切换）
  const isExpanded = expandedRowKeys.length > 0

  // 主卡片块（可被 Portal 包裹进全屏）
  const TableBlock = (
    <Card
      title={t('menuList.title')}
      styles={{ body: { paddingTop: 12 } }}
      extra={
        <TableToolbar
          onCreate={onCreate}
          expanded={isExpanded}
          onToggleExpand={() => (isExpanded ? collapseAll() : expandAll())}
          onRefresh={fetchData}
          size={size}
          onSizeChange={setSize}
          columnSettingPanel={ColumnSetting}
          full={full}
          onToggleFull={() => setFull(v => !v)}
        />
      }
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <Table<TreeMenu>
        className="menus-table"
        rowKey="id"
        loading={loading}
        size={size}
        columns={columns}
        dataSource={tree}
        pagination={false}
        scroll={{ x: 1200, y: (full ? 'calc(100vh - 220px)' : 'calc(100vh - 360px)') as any }}
        expandable={{
          expandedRowKeys,
          onExpandedRowsChange: keys => setExpandedRowKeys([...(keys as React.Key[])]),
          indentSize: 20,
          rowExpandable: record => Array.isArray(record.children) && record.children.length > 0,
          expandIcon: ({ expanded, onExpand, record }) => {
            const hasChildren =
              Array.isArray((record as TreeMenu).children) && (record as TreeMenu).children!.length > 0
            if (!hasChildren) return <span style={{ display: 'inline-block', width: 16 }} />
            return (
              <span
                onClick={e => onExpand?.(record as any, e)}
                style={{
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 16,
                  height: '100%',
                  lineHeight: 0,
                  verticalAlign: 'middle',
                  marginRight: 6,
                }}
              >
                {expanded ? <DownOutlined /> : <RightOutlined />}
              </span>
            )
          },
        }}
      />
    </Card>
  )

  return (
    <div>
      <style>{`
        .menus-table .ant-table-cell-fix-right,
        .menus-table .ant-table-cell-fix-right-first,
        .menus-table .menus-fixed-white { background:#fff !important; }
        .menus-table .ant-table-cell-fix-right-first::after {
          background: linear-gradient(to left, rgba(0,0,0,0.06), rgba(0,0,0,0)) !important;
        }
        .menus-table td .ant-space { max-width: 100%; }
        .menus-table td .ant-space > span:first-child {
          display: inline-block; max-width: 240px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        /* 全屏覆盖容器：Portal 到 body */
        .fs-overlay {
          position: fixed;
          inset: 0;
          z-index: 4000;
          background: #fff;
          overflow: auto;
          padding: 12px;
          box-sizing: border-box;
        }
      `}</style>

      {/* 搜索面板 */}
      <Card size="small" style={{ marginBottom: 12 }} styles={{ body: { paddingBottom: 4 } }}>
        <Form form={searchForm} layout="inline" onFinish={doSearch}>
          <Form.Item name="keyword" label={t('menuList.columns.title')}>
            <Input
              allowClear
              placeholder={t('menuList.placeholders.menu_title')}
              style={{ width: 320 }}
              onPressEnter={() => searchForm.submit()}
            />
          </Form.Item>
          <Form.Item name="type" label={t('menuList.type_label')}>
            <Select
              allowClear
              placeholder={t('menuList.placeholders.menu_type')}
              style={{ width: 160 }}
              options={
                [
                  { value: 'menu', label: t('menuList.type.menu') },
                  { value: 'link', label: t('menuList.type.link') },
                  { value: 'button', label: t('menuList.type.button') },
                ] as any
              }
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                {t('app.search')}
              </Button>
              <Button icon={<RedoOutlined />} onClick={doReset}>
                {t('app.reset')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {/* 表格块：普通渲染 / 全屏 Portal */}
      {!full ? TableBlock : createPortal(<div className="fs-overlay">{TableBlock}</div>, document.body)}

      {/* —— 新增/编辑 弹窗（紧凑版） —— */}
      <style>{`
        .menu-editor .ant-form-item { margin-bottom: 8px; }
        .menu-editor .ant-form-item-label > label { color:#6b7280; font-weight:500; }
        .menu-editor .ant-input,
        .menu-editor .ant-select-selector,
        .menu-editor .ant-input-number,
        .menu-editor .ant-picker { min-height:30px; }
        .menu-editor .ant-select-single .ant-select-selector .ant-select-selection-search-input { height:30px; }
        .ant-tabs-card > .ant-tabs-nav .ant-tabs-tab { border-radius:6px; padding:6px 12px; }
      `}</style>

      {!editorOpen && <Form form={editorForm} style={{ display: 'none' }} />}

      <Modal
        open={editorOpen}
        title={editorInitRef.current?.id ? t('menuList.edit_menu') : t('menuList.add_menu')}
        onCancel={closeEditor}
        onOk={handleSave}
        width={940}
        destroyOnClose
        maskClosable={false}
        okText={t('app.confirm')}
        cancelText={t('app.cancel')}
        styles={{ body: { padding: 12 } }}
        afterOpenChange={opened => {
          if (opened) {
            editorForm.setFieldsValue(editorInitRef.current || {})
          } else {
            editorForm.resetFields()
            editorInitRef.current = null
          }
        }}
      >
        <Tabs
          size="small"
          type="card"
          tabBarGutter={8}
          activeKey={editorType}
          onChange={k => {
            setEditorType(k as UIType)
            editorForm.setFieldsValue({ menu_type: k })
          }}
          items={[
            { key: 'menu', label: t('menuList.type.menu') },
            { key: 'iframe', label: 'iframe' },
            { key: 'link', label: t('menuList.type.link') },
            { key: 'button', label: t('menuList.type.button') },
          ]}
        />

        <Form className="menu-editor" form={editorForm} layout="vertical">
          <Form.Item name="id" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="menu_type" hidden>
            <Input />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {(() => {
              const CommonTop = (
                <>
                  <Form.Item name="parent_id" label={t('menuList.parent_menu')}>
                    <Select
                      allowClear
                      placeholder={t('menuList.placeholders.parent_menu')}
                      options={flat.map(m => ({ value: m.id, label: m.title }))}
                      size="small"
                    />
                  </Form.Item>
                  <Form.Item name="sort_order" label={t('menuList.columns.sort_order')} rules={[{ type: 'number' }]}>
                    <InputNumber min={0} style={{ width: '100%' }} size="small" />
                  </Form.Item>
                  <Form.Item name="title" label={t('menuList.columns.title')} rules={[{ required: true, message: t('menuList.required') }]}>
                    <Input placeholder={t('menuList.placeholders.menu_title')} size="small" />
                  </Form.Item>
                </>
              )

              const BoolButtons = (values: [string, boolean][]) => (
                <Radio.Group optionType="button" buttonStyle="solid" size="small">
                  {values.map(([label, value]) => (
                    <Radio.Button key={String(value)} value={value}>
                      {label}
                    </Radio.Button>
                  ))}
                </Radio.Group>
              )

              if (editorType === 'menu') {
                return (
                  <>
                    {CommonTop}
                    <Form.Item name="name" label={t('menuList.route_name')} rules={[{ required: true, message: t('menuList.required') }]}>
                      <Input placeholder={t('menuList.placeholders.route_name')} size="small" />
                    </Form.Item>
                    <Form.Item name="path" label={t('menuList.columns.path')}>
                      <Input placeholder="/system/menu/index" size="small" />
                    </Form.Item>
                    <Form.Item name="component" label={t('menuList.component_key')}>
                      <Input placeholder={t('menuList.placeholders.component_menu')} size="small" />
                    </Form.Item>
                    <Form.Item name="icon" label={t('menuList.icon')}>
                      <Input placeholder="menu / setting / ..." size="small" />
                    </Form.Item>
                    <Form.Item name="redirect" label={t('menuList.redirect')}>
                      <Input placeholder="/system/menu/index" size="small" />
                    </Form.Item>
                    <Form.Item name="permission_code" label={t('menuList.columns.permission_code')}>
                      <Input placeholder="system:menu:list" size="small" />
                    </Form.Item>

                    <Form.Item label={t('menuList.menu_visibility')} name="is_hidden">
                      {BoolButtons([
                        [t('menuList.visible'), false],
                        [t('menuList.hidden'), true],
                      ])}
                    </Form.Item>
                    <Form.Item label={t('menuList.disabled')} name="is_disabled">
                      {BoolButtons([
                        [t('menuList.enabled'), false],
                        [t('menuList.disabled'), true],
                      ])}
                    </Form.Item>
                    <Form.Item label={t('menuList.keep_alive')} name="keep_alive">
                      {BoolButtons([
                        [t('menuList.cache'), true],
                        [t('menuList.no_cache'), false],
                      ])}
                    </Form.Item>
                    <Form.Item label={t('menuList.affix')} name="affix">
                      {BoolButtons([
                        [t('menuList.fixed'), true],
                        [t('menuList.not_fixed'), false],
                      ])}
                    </Form.Item>
                  </>
                )
              }

              if (editorType === 'iframe') {
                return (
                  <>
                    {CommonTop}
                    <Form.Item name="name" label={t('menuList.route_name')} rules={[{ required: true, message: t('menuList.required') }]}>
                      <Input placeholder={t('menuList.placeholders.route_name')} size="small" />
                    </Form.Item>
                    <Form.Item name="path" label={t('menuList.columns.path')}>
                      <Input placeholder="/iframe/example" size="small" />
                    </Form.Item>
                    <Form.Item name="component" label={t('menuList.component_key')}>
                      <Input placeholder={t('menuList.placeholders.component_iframe')} size="small" />
                    </Form.Item>
                    <Form.Item name="icon" label={t('menuList.icon')}>
                      <Input placeholder="menu / setting / ..." size="small" />
                    </Form.Item>
                    <Form.Item name="iframe_src" label={t('menuList.iframe_url')} rules={[{ required: true, message: t('menuList.required') }]}>
                      <Input placeholder="https://example.com" size="small" />
                    </Form.Item>
                    <Form.Item label={t('menuList.menu_visibility')} name="is_hidden">
                      {BoolButtons([
                        [t('menuList.visible'), false],
                        [t('menuList.hidden'), true],
                      ])}
                    </Form.Item>
                    <Form.Item label={t('menuList.disabled')} name="is_disabled">
                      {BoolButtons([
                        [t('menuList.enabled'), false],
                        [t('menuList.disabled'), true],
                      ])}
                    </Form.Item>
                  </>
                )
              }

              if (editorType === 'link') {
                return (
                  <>
                    {CommonTop}
                    <Form.Item name="name" label={t('menuList.name')} rules={[{ required: true, message: t('menuList.required') }]}>
                      <Input placeholder={t('menuList.placeholders.link_name')} size="small" />
                    </Form.Item>
                    <Form.Item name="iframe_src" label={t('menuList.link_url')} rules={[{ required: true, message: t('menuList.required') }]}>
                      <Input placeholder="https://example.com" size="small" />
                    </Form.Item>
                    <Form.Item label={t('menuList.menu_visibility')} name="is_hidden">
                      {BoolButtons([
                        [t('menuList.visible'), false],
                        [t('menuList.hidden'), true],
                      ])}
                    </Form.Item>
                  </>
                )
              }

              // button
              return (
                <>
                  {CommonTop}
                  <Form.Item name="permission_code" label={t('menuList.columns.permission_code')} rules={[{ required: true, message: t('menuList.required') }]}>
                    <Input placeholder="system:xxx:action" size="small" />
                  </Form.Item>
                </>
              )
            })()}
          </div>
        </Form>
      </Modal>
    </div>
  )
}
