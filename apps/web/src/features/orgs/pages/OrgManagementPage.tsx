import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  App,
  Button,
  Card,
  Checkbox,
  Dropdown,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  TreeSelect,
  Typography,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
  ColumnHeightOutlined,
  SettingOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  HolderOutlined,
  RightOutlined,
  DownOutlined,
} from '@ant-design/icons'
import { createPortal } from 'react-dom'
import { orgsApi, type OrgNode } from '@/shared/api/endpoints/orgs'
import { useLanguage } from '@/shared/contexts/LanguageContext'
import { formatDateTime } from '@/shared/utils/datetime'

const { Text } = Typography

type StatusFilter = '' | 'enabled' | 'disabled'
type ColKey = 'name' | 'sort_order' | 'is_enabled' | 'created_at' | 'description' | 'actions'
const COLUMN_LABEL_KEYS: Record<ColKey, string> = {
  name: 'orgs.columns.name',
  sort_order: 'orgs.columns.sort_order',
  is_enabled: 'orgs.columns.status',
  created_at: 'orgs.columns.created_at',
  description: 'orgs.columns.description',
  actions: 'orgs.columns.actions',
}

/* ====================== 页面：组织管理（树形表格） ====================== */
export default function OrgManagementPage() {
  const { message } = App.useApp()
  const { t } = useLanguage()

  // ------------ 数据 ------------
  const [loading, setLoading] = useState(false)
  const [tree, setTree] = useState<OrgNode[]>([])

  // ------------ 顶部筛选 ------------
  const [kw, setKw] = useState('')
  const [status, setStatus] = useState<StatusFilter>('')

  // ------------ 拉取树 ------------
  const loadTree = async () => {
    setLoading(true)
    try {
      const t = await orgsApi.tree()
      setTree(Array.isArray(t) ? t : [])
    } catch (e: any) {
      message.error(e?.message || t('orgs.message.load_failed'))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void loadTree()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ------------ 过滤（名称 + 状态） ------------
  const filteredTree = useMemo(() => {
    const kwLower = kw.trim().toLowerCase()
    const matchName = (n: OrgNode) => (kwLower ? (n.name || '').toLowerCase().includes(kwLower) : true)
    const matchStatus = (n: OrgNode) => {
      if (!status) return true
      const enabled =
        typeof n.is_enabled !== 'undefined'
          ? !!n.is_enabled
          : (n as any).is_active === 1 || (n as any).is_active === true
      return status === 'enabled' ? enabled : !enabled
    }

    const dfs = (nodes: OrgNode[]): OrgNode[] => {
      return (nodes || [])
        .map(n => {
          const children = dfs(n.children || [])
          const hit = matchName(n) && matchStatus(n)
          if (hit || children.length) return { ...n, children }
          return null
        })
        .filter(Boolean) as OrgNode[]
    }

    return dfs(tree)
  }, [tree, kw, status])

  // ============ 树展开/收起 ============
  const allRowKeys = useMemo<number[]>(() => {
    const acc: number[] = []
    const walk = (nodes: OrgNode[] = []) => {
      nodes.forEach(n => {
        acc.push(n.id)
        if (n.children?.length) walk(n.children)
      })
    }
    walk(filteredTree)
    return acc
  }, [filteredTree])

  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([])
  const [expandedAll, setExpandedAll] = useState(true)
  useEffect(() => {
    // 过滤变化时默认展开全部
    setExpandedRowKeys(allRowKeys)
    setExpandedAll(true)
  }, [allRowKeys])
  const toggleExpandAll = () => {
    if (expandedAll) {
      setExpandedRowKeys([])
      setExpandedAll(false)
    } else {
      setExpandedRowKeys(allRowKeys)
      setExpandedAll(true)
    }
  }

  // ------------ 新增/编辑 弹窗 ------------
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<OrgNode | null>(null)
  const [parentForCreate, setParentForCreate] = useState<OrgNode | null>(null)

  const openCreate = (parent?: OrgNode) => {
    setEditing(null)
    setParentForCreate(parent ?? null)
    setFormOpen(true)
  }
  const openEdit = (row: OrgNode) => {
    setEditing(row)
    setParentForCreate(null)
    setFormOpen(true)
  }

  const handleDelete = async (row: OrgNode) => {
    try {
      await orgsApi.remove(row.id)
      message.success(t('orgs.message.delete_success'))
      await loadTree()
    } catch (e: any) {
      message.error(e?.message || t('orgs.message.delete_failed'))
    }
  }

  // ------------ 列显示 / 顺序 / 密度 / 全屏 ------------
  const labels = useMemo<Record<ColKey, string>>(() => {
    const resolved = {} as Record<ColKey, string>
    ;(Object.keys(COLUMN_LABEL_KEYS) as ColKey[]).forEach(key => {
      resolved[key] = t(COLUMN_LABEL_KEYS[key])
    })
    return resolved
  }, [t])
  const DEFAULT_COL_KEYS: ColKey[] = ['name', 'sort_order', 'is_enabled', 'created_at', 'description', 'actions']
  const FIXED_KEY: ColKey = 'actions' // 固定在末尾，不可拖拽

  // 只管理“非固定列”的顺序，不受显隐影响；用于解决“取消后再勾选保持原位置”
  const [order, setOrder] = useState<ColKey[]>(DEFAULT_COL_KEYS.filter(k => k !== FIXED_KEY))
  // 显隐集合（初始全选）
  const [visibleColKeys, setVisibleColKeys] = useState<ColKey[]>(DEFAULT_COL_KEYS)

  const [tableSize, setTableSize] = useState<'small' | 'middle' | 'large'>('middle')

  // 局部全屏
  const [fs, setFs] = useState(false)
  useEffect(() => {
    if (!fs) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [fs])

  // 实际用于渲染的“可见列 + 顺序”
  const visibleOrderedKeys = useMemo<ColKey[]>(() => {
    const nonFixedVisible = order.filter(k => visibleColKeys.includes(k))
    const res: ColKey[] = [...nonFixedVisible]
    if (visibleColKeys.includes(FIXED_KEY)) res.push(FIXED_KEY)
    return res
  }, [order, visibleColKeys])

  // ------------ 表格列（按可见列生成） ------------
  const columnDefs = useMemo<Record<ColKey, any>>(
    () => ({
      name: { title: labels.name, dataIndex: 'name', key: 'name', ellipsis: true },
      sort_order: {
        title: labels.sort_order,
        dataIndex: 'sort_order',
        key: 'sort_order',
        width: 80,
        align: 'center',
        render: (v: any) => (typeof v === 'number' ? v : ''),
      },
      is_enabled: {
        title: labels.is_enabled,
        dataIndex: 'is_enabled',
        key: 'is_enabled',
        width: 100,
        align: 'center',
        render: (_: any, r: OrgNode) => {
          const enabled =
            typeof r.is_enabled !== 'undefined'
              ? !!r.is_enabled
              : (r as any).is_active === 1 || (r as any).is_active === true
          const statusText = enabled ? t('orgs.status.enabled') : t('orgs.status.disabled')
          return <Tag color={enabled ? 'success' : 'error'} style={{ marginInline: 0 }}>{statusText}</Tag>
        },
      },
      created_at: {
        title: labels.created_at,
        dataIndex: 'created_at',
        key: 'created_at',
        width: 180,
        align: 'center',
        render: (t: any) => (t ? formatDateTime(t) : ''),
      },
      description: {
        title: labels.description,
        dataIndex: 'description',
        key: 'description',
        ellipsis: true,
        render: (t: any) => (t ? t : ''),
      },
      actions: {
        title: labels.actions,
        key: 'actions',
        width: 220,
        align: 'center',
        render: (_: any, r: OrgNode) => (
          <Space size="small" wrap>
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>
              {t('app.edit')}
            </Button>
            <Button type="link" size="small" onClick={() => openCreate(r)}>
              {t('orgs.action.add_child')}
            </Button>
            <Popconfirm
              title={t('orgs.modal.delete_title')}
              okText={t('app.delete')}
              okButtonProps={{ danger: true }}
              onConfirm={() => handleDelete(r)}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                {t('app.delete')}
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    }),
    [labels, t]
  )
  const columns = useMemo(() => visibleOrderedKeys.map(k => columnDefs[k]), [visibleOrderedKeys, columnDefs])

  // ========== 列设置：拖拽 ==========
  const dragKeyRef = useRef<ColKey | null>(null)
  const onDragStart = (k: ColKey) => (e: React.DragEvent) => {
    dragKeyRef.current = k
    e.dataTransfer.effectAllowed = 'move'
    // Firefox 需要 setData 才能触发 drop
    e.dataTransfer.setData('text/plain', k)
  }
  const onDragOver = (k: ColKey) => (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }
  const move = (arr: ColKey[], from: number, to: number) => {
    const a = [...arr]
    const item = a.splice(from, 1)[0]
    a.splice(to, 0, item)
    return a
  }
  const onDrop = (targetKey: ColKey) => (e: React.DragEvent) => {
    e.preventDefault()
    const fromKey = dragKeyRef.current
    dragKeyRef.current = null
    if (!fromKey || fromKey === targetKey) return
    // 只在“非固定列”之间移动
    const arr = [...order]
    const from = arr.indexOf(fromKey)
    const to = arr.indexOf(targetKey)
    if (from === -1 || to === -1) return
    setOrder(move(arr, from, to))
  }

  // 主复选框（全选/全不选）
  const allChecked = visibleColKeys.length === DEFAULT_COL_KEYS.length
  const indeterminate = visibleColKeys.length > 0 && !allChecked

  // =================== 主表格块（可放入全屏 Portal） ===================
  const TableBlock = (
    <Card className="orgs-table-card" styles={{ body: { padding: 12 } }}>
      {/* 表格工具栏 */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 16 }}>{t('orgs.title')}</div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreate()}>
            {t('orgs.action.add_department')}
          </Button>

          {/* 折叠/展开 */}
          <Tooltip title={expandedAll ? t('table.toolbar.collapse_all') : t('table.toolbar.expand_all')}>
            <Button icon={expandedAll ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />} onClick={toggleExpandAll} />
          </Tooltip>

          {/* 刷新 */}
          <Tooltip title={t('app.refresh')}>
            <Button icon={<ReloadOutlined />} onClick={() => loadTree()} />
          </Tooltip>

          {/* 密度 */}
          <Dropdown
            trigger={['click']}
            menu={{
              selectable: true,
              selectedKeys: [tableSize],
              items: [
                { key: 'large', label: t('table.density.loose') },
                { key: 'middle', label: t('table.density.default') },
                { key: 'small', label: t('table.density.compact') },
              ],
              onClick: ({ key }) => setTableSize(key as any),
            }}
          >
            <Tooltip title={t('table.toolbar.density')}>
              <Button
                icon={<ColumnHeightOutlined />}
                aria-label={t('table.toolbar.density')}
                title={`${t('table.toolbar.density')}: ${
                  tableSize === 'large'
                    ? t('table.density.loose')
                    : tableSize === 'small'
                      ? t('table.density.compact')
                      : t('table.density.default')
                }`}
              />
            </Tooltip>
          </Dropdown>

          {/* 列设置（可拖拽） */}
          <Dropdown
            trigger={['click']}
            dropdownRender={() => (
              <div className="col-setting-panel">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                  }}
                >
                  <Checkbox
                    checked={allChecked}
                    indeterminate={indeterminate}
                    onChange={e => setVisibleColKeys(e.target.checked ? DEFAULT_COL_KEYS : [])}
                  >
                    {t('orgs.columns.panel_title')}
                  </Checkbox>
                  <a
                    onClick={() => {
                      setOrder(DEFAULT_COL_KEYS.filter(k => k !== FIXED_KEY))
                      setVisibleColKeys(DEFAULT_COL_KEYS)
                    }}
                  >
                    {t('orgs.columns.reset')}
                  </a>
                </div>

                {/* 非固定列：按 order 顺序展示，可拖拽 */}
                <div style={{ padding: '6px 12px 0' }}>
                  {order.map(k => (
                    <div
                      key={k}
                      className="col-setting-row"
                      draggable
                      onDragStart={onDragStart(k)}
                      onDragOver={onDragOver(k)}
                      onDrop={onDrop(k)}
                    >
                      <HolderOutlined className="col-setting-handle" />
                      <Checkbox
                        checked={visibleColKeys.includes(k)}
                        onChange={e =>
                          setVisibleColKeys(prev => (e.target.checked ? [...prev, k] : prev.filter(x => x !== k)))
                        }
                      >
                        {labels[k]}
                      </Checkbox>
                    </div>
                  ))}

                  {/* 固定列“操作”：不可拖拽 */}
                  <div className="col-setting-row col-fixed">
                    <HolderOutlined className="col-setting-handle disabled" />
                    <Checkbox
                      checked={visibleColKeys.includes(FIXED_KEY)}
                      onChange={e =>
                        setVisibleColKeys(prev =>
                          e.target.checked ? [...prev, FIXED_KEY] : prev.filter(x => x !== FIXED_KEY)
                        )
                      }
                    >
                      {`${labels[FIXED_KEY]}${t('table.columns.fixed_suffix')}`}
                    </Checkbox>
                  </div>
                </div>
              </div>
            )}
          >
            <Tooltip title={t('table.toolbar.column_settings')}>
              <Button icon={<SettingOutlined />} />
            </Tooltip>
          </Dropdown>

          {/* 全屏 */}
          <Tooltip title={fs ? t('table.toolbar.exit_fullscreen') : t('table.toolbar.fullscreen')}>
            <Button icon={fs ? <FullscreenExitOutlined /> : <FullscreenOutlined />} onClick={() => setFs(v => !v)} />
          </Tooltip>
        </div>
      </div>

      <Table<OrgNode>
        className="orgs-table"
        rowKey="id"
        columns={columns as any}
        dataSource={filteredTree}
        loading={loading}
        pagination={false}
        bordered
        size={tableSize}
        expandable={{
          expandedRowKeys,
          onExpandedRowsChange: keys => setExpandedRowKeys(keys as React.Key[]),
          expandRowByClick: false,
          // ✅ 自定义展开图标：只显示箭头；无子级不显示（仅占位保持对齐）
          expandIcon: ({ expanded, onExpand, record }) => {
            const hasChildren = Array.isArray((record as OrgNode).children) && (record as OrgNode).children!.length > 0
            if (!hasChildren) {
              // antd 自带的“spaced”占位，不显示任何图标；用于没有子级时对齐
              return <span className="ant-table-row-expand-icon-spaced" />
            }
            // 注意：不要使用 ant-table-row-expand-icon 类，否则会出现自带的加/减号
            return (
              <span
                className="orgs-expand-trigger"
                onClick={e => onExpand(record as any, e)}
                aria-label={expanded ? t('table.toolbar.collapse_row') : t('table.toolbar.expand_row')}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <style>{`
        .orgs-table-card {
          border-radius: 10px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.045);
        }
        .orgs-table .ant-table-thead > tr > th {
          background-color: #f5f7fa !important;
          text-align: center;
        }
        .orgs-table .ant-table-tbody > tr > td {
          text-align: left;
        }
        .col-setting-panel {
          width: 260px;
          background: #fff;
          border: 1px solid #f0f0f0;
          border-radius: 8px;
          box-shadow: 0 8px 24px rgba(0,0,0,.06);
          user-select: none;
        }
        .col-setting-row {
          display:flex; align-items:center; gap:8px;
          padding:6px 4px;
          border-radius:8px;
        }
        .col-setting-row.dragover { background: rgba(22,119,255,.06); }
        .col-setting-handle { color:#94a3b8; cursor:grab; }
        .col-setting-handle.disabled { opacity:.35; cursor:not-allowed; }
        /* 局部全屏 */
        .fs-overlay {
          position: fixed;
          inset: 0;
          z-index: 4000;
          background: #fff;
          overflow: auto;
          padding: 12px;
          box-sizing: border-box;
        }
        /* 自定义展开箭头按钮（去掉加减号背景） */
        .orgs-expand-trigger{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          width:16px;
          height:16px;
          margin-inline-end: 8px;
          cursor:pointer;
          color: rgba(0,0,0,0.65);
        }
        .orgs-expand-trigger:hover{ color: rgba(0,0,0,0.88); }
      `}</style>

      {/* 顶部筛选卡片 */}
      <Card styles={{ body: { padding: 16 } }}>
        <Space wrap size={16} style={{ width: '100%' }}>
          <Space>
            <span style={{ width: 72, textAlign: 'right', color: '#6b7280' }}>{t('orgs.filters.name_label')}</span>
            <Input
              allowClear
              placeholder={t('orgs.filters.name_placeholder')}
              style={{ width: 240 }}
              value={kw}
              onChange={e => setKw(e.target.value)}
            />
          </Space>
          <Space>
            <span style={{ width: 56, textAlign: 'right', color: '#6b7280' }}>{t('orgs.filters.status_label')}</span>
            <Select
              placeholder={t('orgs.filters.status_placeholder')}
              allowClear
              style={{ width: 180 }}
              value={status || undefined}
              options={[
                { label: t('orgs.status.enabled'), value: 'enabled' },
                { label: t('orgs.status.disabled'), value: 'disabled' },
              ]}
              onChange={v => setStatus((v as StatusFilter) || '')}
            />
          </Space>

          <Space style={{ marginLeft: 'auto' }}>
            <Button type="primary" icon={<SearchOutlined />}>
              {t('app.search')}
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                setKw('')
                setStatus('')
                void loadTree()
              }}
            >
              {t('app.reset')}
            </Button>
          </Space>
        </Space>
      </Card>

      {/* 表格块：普通模式直接渲染；全屏时用 Portal 完全覆盖 */}
      {!fs ? TableBlock : createPortal(<div className="fs-overlay">{TableBlock}</div>, document.body)}

      {/* 新增/编辑表单 */}
      <DeptFormModal
        open={formOpen}
        tree={tree}
        editing={editing}
        parentForCreate={parentForCreate}
        onCancel={() => setFormOpen(false)}
        onOk={async (payload, ctx) => {
          try {
            if (ctx.type === 'create') {
              await orgsApi.create(payload)
              message.success(t('orgs.message.create_success'))
            } else {
              await orgsApi.update(ctx.id!, payload)
              message.success(t('orgs.message.save_success'))
            }
            setFormOpen(false)
            setEditing(null)
            setParentForCreate(null)
            await loadTree()
          } catch (e: any) {
            message.error(e?.message || t('orgs.message.action_failed'))
          }
        }}
      />
    </div>
  )
}

/* ====================== 表单弹窗：新增 / 修改 ====================== */

function DeptFormModal({
  open,
  tree,
  editing,
  parentForCreate,
  onOk,
  onCancel,
}: {
  open: boolean
  tree: OrgNode[]
  editing: OrgNode | null
  parentForCreate: OrgNode | null
  onOk: (payload: Partial<OrgNode>, ctx: { type: 'create' | 'edit'; id?: number }) => Promise<void> | void
  onCancel: () => void
}) {
  const [form] = Form.useForm<Partial<OrgNode>>()
  const { t } = useLanguage()

  // —— 构建上级部门 TreeSelect 数据 —— //
  type TSData = { title: string; value: number; children?: TSData[]; disabled?: boolean }
  const buildTS = (nodes: OrgNode[], disabledIds = new Set<number>()): TSData[] =>
    (nodes || []).map(n => ({
      title: n.name || `#${n.id}`,
      value: n.id,
      disabled: disabledIds.has(n.id),
      children: n.children?.length ? buildTS(n.children, disabledIds) : undefined,
    }))

  // 禁止选择：自己及其子孙
  const disabledIds = useMemo(() => {
    const set = new Set<number>()
    if (!editing) return set
    const walk = (n?: OrgNode | null) => {
      if (!n) return
      set.add(n.id)
      ;(n.children || []).forEach(walk)
    }
    const locate = (nodes: OrgNode[], id: number): OrgNode | null => {
      for (const n of nodes || []) {
        if (n.id === id) return n
        const hit = locate(n.children || [], id)
        if (hit) return hit
      }
      return null
    }
    walk(locate(tree, editing.id))
    return set
  }, [editing, tree])

  const tsData = useMemo(() => buildTS(tree, disabledIds), [tree, disabledIds])

  // 初始值
  useEffect(() => {
    if (!open) return
    const enabled =
      typeof editing?.is_enabled !== 'undefined'
        ? !!editing?.is_enabled
        : (editing as any)?.is_active === 1 || (editing as any)?.is_active === true

    form.resetFields()
    if (editing) {
      form.setFieldsValue({
        parent_id: editing.parent_id ?? null,
        name: editing.name,
        leader: editing.leader ?? undefined,
        phone: editing.phone ?? undefined,
        email: editing.email ?? undefined,
        sort_order: editing.sort_order ?? 0,
        is_enabled: enabled,
        description: editing.description ?? undefined,
      })
    } else {
      form.setFieldsValue({
        parent_id: parentForCreate?.id ?? null,
        name: undefined,
        leader: undefined,
        phone: undefined,
        email: undefined,
        // ❗️不要默认 0；留空让后端自动“最大+1”
        // sort_order: 0,
        is_enabled: true,
        description: undefined,
      })
    }
  }, [open, editing, parentForCreate, form])

  const handleOk = async () => {
    const v = await form.validateFields()
    const payload: Partial<OrgNode> = {
      parent_id: v.parent_id ?? null,
      name: (v.name || '').trim(),
      leader: v.leader?.trim() || null,
      phone: v.phone?.trim() || null,
      email: v.email?.trim() || null,
      description: v.description?.trim() || null,
      is_enabled: !!v.is_enabled,
      // 兼容后端 is_active 场景
      // @ts-ignore
      is_active: v.is_enabled ? 1 : 0,
    }
    // ✅ 仅当用户输入了合法数字时才携带 sort_order
    if (Number.isFinite(v.sort_order)) {
      payload.sort_order = Number(v.sort_order)
    }

    if (editing) await onOk(payload, { type: 'edit', id: editing.id })
    else await onOk(payload, { type: 'create' })
  }

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      title={editing ? t('orgs.form.title.edit') : parentForCreate ? t('orgs.form.title.create_child') : t('orgs.form.title.create')}
      okText={editing ? t('orgs.form.submit.edit') : t('orgs.form.submit.create')}
      destroyOnClose
      maskClosable={false}
      width={660}
    >
      <Form form={form} layout="horizontal" labelCol={{ span: 5 }} wrapperCol={{ span: 18 }}>
        <Form.Item label={t('orgs.form.parent')} name="parent_id">
          <TreeSelect
            allowClear
            treeData={tsData as any}
            placeholder={t('orgs.form.parent_placeholder')}
            treeDefaultExpandAll
            style={{ width: '100%' }}
            dropdownStyle={{ maxHeight: 360, overflow: 'auto' }}
          />
        </Form.Item>

        <Form.Item
          label={t('orgs.form.name')}
          name="name"
          rules={[
            { required: true, message: t('orgs.form.name_required') },
            { max: 64, message: t('orgs.form.name_max') },
          ]}
        >
          <Input placeholder={t('orgs.form.name_placeholder')} />
        </Form.Item>

        <Form.Item label={t('orgs.form.leader')} name="leader" rules={[{ max: 64 }]}>
          <Input placeholder={t('orgs.form.optional')} />
        </Form.Item>

        <Form.Item label={t('orgs.form.phone')} name="phone" rules={[{ max: 32 }]}>
          <Input placeholder={t('orgs.form.optional')} />
        </Form.Item>

        <Form.Item
          label={t('orgs.form.email')}
          name="email"
          rules={[{ type: 'email', message: t('orgs.form.email_invalid') }, { max: 128 }]}
        >
          <Input placeholder={t('orgs.form.optional')} />
        </Form.Item>

        <Form.Item label={t('orgs.form.sort_order')} name="sort_order">
          <InputNumber min={0} step={1} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item label={t('orgs.form.status')} name="is_enabled" valuePropName="checked">
          <Switch checkedChildren={t('orgs.status.enabled')} unCheckedChildren={t('orgs.status.disabled')} />
        </Form.Item>

        <Form.Item label={t('orgs.form.remark')} name="description" rules={[{ max: 500 }]}>
          <Input.TextArea rows={4} placeholder={t('orgs.form.remark_placeholder')} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
