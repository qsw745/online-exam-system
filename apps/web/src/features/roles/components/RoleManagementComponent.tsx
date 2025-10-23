import {
  CheckOutlined,
  CloseOutlined,
  ColumnHeightOutlined,
  ExclamationCircleFilled,
  FullscreenExitOutlined,
  FullscreenOutlined,
  HolderOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import type { TableProps } from 'antd'
import {
  App,
  Button,
  Card,
  Checkbox,
  Divider,
  Dropdown,
  Empty,
  Grid,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Select,
  Space,
  Switch,
  Table,
  Tooltip,
  Tree,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import type { Role } from '@/shared/api/endpoints/roles'
import { rolesApi } from '@/shared/api/endpoints/roles'

import RoleFormModal from '@/features/roles/components/RoleFormModal'
import RoleMembersModal from '@/features/roles/components/RoleMembersModal'
import UserSelectModal from '@/features/roles/components/UserSelectModal'

import { useRoleMembers } from '@/features/roles/hooks/useRoleMembers'
import { useRolePermissions } from '@/features/roles/hooks/useRolePermissions'

// —— 小工具 —— //
const isOk = (r: any) => r?.success !== false && !r?.error
const getMsg = (r: any, fallback: string) => r?.message || r?.error || fallback
const unwrap = (r: any) => (r && typeof r === 'object' && 'data' in r ? (r as any).data : r)
const toNumberArray = (keys: React.Key[]): number[] =>
  keys.map(k => (typeof k === 'number' ? k : parseInt(String(k), 10))).filter(k => !isNaN(k))

type RoleStatusFilter = '' | 'enabled' | 'disabled'
const STATUS_OPTIONS: { label: string; value: Exclude<RoleStatusFilter, ''> }[] = [
  { label: '已启用', value: 'enabled' },
  { label: '已停用', value: 'disabled' },
]

// 右侧面板宽度
const PANEL_WIDTH = 420

type ColKey = 'id' | 'name' | 'code' | 'is_disabled' | 'description' | 'created_at' | 'actions'
const FIXED_LAST_KEY: ColKey = 'actions'

export default function RoleManagementComponent() {
  const { message } = App.useApp()
  const screens = Grid.useBreakpoint()
  const isXs = !!screens.xs && !screens.sm // <576px

  // ===== 查询面板状态 =====
  const [fName, setFName] = useState('')
  const [fCode, setFCode] = useState('')
  const [fStatus, setFStatus] = useState<RoleStatusFilter>('')

  // ===== 列表分页 =====
  const [loading, setLoading] = useState(false)
  const [list, setList] = useState<Role[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // ===== 新建/编辑 =====
  const [formOpen, setFormOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)

  // ===== 权限 & 成员 =====
  const perms = useRolePermissions()
  const members = useRoleMembers()

  // ===== 表格密度 / 列设置 =====
  const [tableSize, setTableSize] = useState<TableProps<Role>['size']>('small') // 默认更紧凑

  const DEFAULT_COL_KEYS: ColKey[] = ['id', 'name', 'code', 'is_disabled', 'description', 'created_at', 'actions']
  const LABELS: Record<ColKey, string> = {
    id: '角色编号',
    name: '角色名称',
    code: '角色标识',
    is_disabled: '状态',
    description: '备注',
    created_at: '创建时间',
    actions: '操作',
  }

  // —— 可见列（只管显隐） —— //
  const [visibleColKeys, setVisibleColKeys] = useState<ColKey[]>(DEFAULT_COL_KEYS)

  // —— 列顺序（独立于显隐；actions 固定末列） —— //
  const [colOrder, setColOrder] = useState<ColKey[]>(DEFAULT_COL_KEYS)

  // —— 列拖拽（HTML5 DnD） —— //
  const dragKeyRef = useRef<ColKey | null>(null)
  const [dragOverKey, setDragOverKey] = useState<ColKey | null>(null)

  const onDragStart = (key: ColKey) => {
    if (key === FIXED_LAST_KEY) return
    dragKeyRef.current = key
  }
  const onDragEnter = (key: ColKey) => {
    if (key === FIXED_LAST_KEY) return
    setDragOverKey(key)
  }
  const onDragLeave = (key: ColKey) => {
    if (dragOverKey === key) setDragOverKey(null)
  }
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }
  const onDrop = (targetKey: ColKey) => {
    const from = dragKeyRef.current
    setDragOverKey(null)
    dragKeyRef.current = null
    if (!from || from === targetKey) return
    if (from === FIXED_LAST_KEY || targetKey === FIXED_LAST_KEY) return

    setColOrder(prev => {
      // 只对非固定列重排，固定列继续放末尾
      const nonFixed = prev.filter(k => k !== FIXED_LAST_KEY)
      const fromIdx = nonFixed.indexOf(from)
      const toIdx = nonFixed.indexOf(targetKey)
      if (fromIdx < 0 || toIdx < 0) return prev
      const next = [...nonFixed]
      next.splice(toIdx, 0, ...next.splice(fromIdx, 1))
      return [...next, FIXED_LAST_KEY]
    })
  }

  // —— 拉取列表（支持状态筛选） —— //
  const load = async (p = page, s = pageSize) => {
    setLoading(true)
    try {
      const kwParts = [fName?.trim(), fCode?.trim()].filter(Boolean)
      const keyword = kwParts.join(' ').trim() || undefined

      const needStatusFilter = !!fStatus
      const bigPageSize = needStatusFilter ? Math.max(1000, s) : s

      const resp = await (rolesApi.list as any)({
        page: needStatusFilter ? 1 : p,
        pageSize: bigPageSize,
        keyword,
        status: fStatus,
      })
      if (!isOk(resp)) throw new Error(getMsg(resp, '加载角色失败'))

      const data = unwrap(resp)
      const arr: Role[] = Array.isArray((data as any)?.roles) ? (data as any).roles : (data as Role[])

      if (needStatusFilter) {
        const filtered = arr.filter(r => {
          const disabled = r.is_disabled === 1 || r.is_disabled === true
          return fStatus === 'enabled' ? !disabled : disabled
        })
        const start = (p - 1) * s
        const end = start + s
        setList(filtered.slice(start, end))
        setTotal(filtered.length)
        setPage(p)
        setPageSize(s)
      } else {
        setList(arr)
        setTotal(Number((data as any)?.total ?? arr.length) || 0)
        setPage(Number((data as any)?.page ?? p) || 1)
        setPageSize(Number((data as any)?.pageSize ?? s) || 10)
      }
    } catch (e: any) {
      message.error(e?.message || '加载角色失败')
      setList([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(1, pageSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // —— 操作 —— //
  const openCreate = () => {
    setEditingRole(null)
    setFormOpen(true)
  }
  const openEdit = (r: Role) => {
    setEditingRole(r)
    setFormOpen(true)
  }
  const handleSave = async (payload: { name: string; code?: string; description?: string }) => {
    try {
      if (editingRole?.id) {
        const r = await rolesApi.update(editingRole.id, payload)
        if (!isOk(r)) throw new Error(getMsg(r, '更新失败'))
        message.success('更新成功')
        setFormOpen(false)
        await load(page, pageSize)
      } else {
        const r = await rolesApi.create(payload)
        if (!isOk(r)) throw new Error(getMsg(r, '创建失败'))
        message.success('创建成功')
        setFormOpen(false)
        await load(1, pageSize)
      }
    } catch (e: any) {
      message.error(e?.message || '保存失败')
    }
  }
  const handleDelete = (r: Role) => {
    Modal.confirm({
      title: '确定要删除这个角色吗？',
      content: '删除后将无法恢复',
      okText: '删除',
      okButtonProps: { danger: true },
      async onOk() {
        try {
          const res = await rolesApi.remove(r.id)
          if (!isOk(res)) throw new Error(getMsg(res, '删除失败'))
          message.success('删除成功')
          const willLeft = total - 1 - (page - 1) * pageSize
          if (willLeft <= 0 && page > 1) await load(page - 1, pageSize)
          else await load(page, pageSize)
        } catch (e: any) {
          message.error(e?.message || '删除失败')
        }
      },
    })
  }

  // —— 状态切换（开关 + 启用/停用都确认） —— //
  const [statusLoadingId, setStatusLoadingId] = useState<number | null>(null)
  const setRowDisabled = (id: number, is_disabled: 0 | 1 | boolean) =>
    setList(prev => prev.map(it => (it.id === id ? ({ ...it, is_disabled } as Role) : it)))

  const toggleStatus = async (r: Role, enabled: boolean) => {
    const newDisabled = enabled ? 0 : 1
    setStatusLoadingId(r.id)
    try {
      const res = await rolesApi.update(r.id, { is_disabled: newDisabled } as any)
      if (!isOk(res)) throw new Error(getMsg(res, '状态更新失败'))
      setRowDisabled(r.id, newDisabled)
      message.success(enabled ? '已启用' : '已停用')
    } catch (e: any) {
      message.error(e?.message || '状态更新失败')
      setRowDisabled(r.id, r.is_disabled as any) // 回滚
    } finally {
      setStatusLoadingId(null)
    }
  }

  const confirmToggle = (r: Role, nextEnabled: boolean) => {
    const fromEnabled = !(r.is_disabled === 1 || r.is_disabled === true)
    if (fromEnabled === nextEnabled) return
    const text = nextEnabled ? '启用' : '停用'
    Modal.confirm({
      title: '系统提示',
      icon: <ExclamationCircleFilled style={{ color: '#faad14' }} />,
      content: (
        <span>
          确认要{text}
          <strong style={{ margin: '0 4px' }}>{r.name}</strong>
          角色吗？
        </span>
      ),
      okText: '确定',
      cancelText: '取消',
      onOk: async () => toggleStatus(r, nextEnabled),
    })
  }

  // —— 列定义（设置列宽 + 固定操作列） —— //
  const actionMenu = (r: Role) => ({
    items: [
      { key: 'edit', label: '修改', onClick: () => openEdit(r) },
      { key: 'perm', label: '权限', onClick: () => perms.openFor({ id: r.id, name: r.name } as any) },
      { type: 'divider' as const },
      {
        key: 'del',
        danger: true,
        label: '删除',
        disabled: !!r.is_system,
        onClick: () => handleDelete(r),
      },
    ],
  })

  const ALL_COLUMNS: Record<ColKey, any> = {
    id: { title: LABELS.id, dataIndex: 'id', align: 'center', width: 100 },
    name: { title: LABELS.name, dataIndex: 'name', ellipsis: true, align: 'center', width: 180 },
    code: { title: LABELS.code, dataIndex: 'code', ellipsis: true, align: 'center', width: 160 },
    is_disabled: {
      title: LABELS.is_disabled,
      dataIndex: 'is_disabled',
      align: 'center',
      width: 140,
      render: (_: any, r: Role) => {
        const enabled = !(r.is_disabled === 1 || r.is_disabled === true)
        return (
          <Switch
            size="small"
            checked={enabled}
            checkedChildren="已启用"
            unCheckedChildren="已停用"
            loading={statusLoadingId === r.id}
            onChange={checked => confirmToggle(r, checked)}
          />
        )
      },
    },
    description: {
      title: LABELS.description,
      dataIndex: 'description',
      ellipsis: true,
      align: 'center',
      width: 220,
      render: (t: any) => t || <Typography.Text type="secondary">—</Typography.Text>,
    },
    created_at: {
      title: LABELS.created_at,
      dataIndex: 'created_at',
      ellipsis: true,
      align: 'center',
      width: 180,
      render: (t: any) => (t ? new Date(t).toLocaleString() : '—'),
    },
    actions: {
      title: LABELS.actions,
      key: 'actions',
      align: 'center',
      fixed: 'right' as const,
      width: 200,
      render: (_: any, r: Role) =>
        isXs ? (
          <Dropdown menu={actionMenu(r)} trigger={['click']}>
            <Button size="small" icon={<MoreOutlined />}>
              更多
            </Button>
          </Dropdown>
        ) : (
          <Space size="small" wrap>
            <Button type="link" size="small" onClick={() => openEdit(r)}>
              修改
            </Button>
            <Button type="link" size="small" onClick={() => perms.openFor({ id: r.id, name: r.name } as any)}>
              权限
            </Button>
            <Button type="link" size="small" danger onClick={() => handleDelete(r)} disabled={!!r.is_system}>
              删除
            </Button>
          </Space>
        ),
    },
  }

  // —— 最终展示用列顺序：用 colOrder 过滤 visible —— //
  const orderedVisibleKeys: ColKey[] = useMemo(() => {
    const visibleSet = new Set(visibleColKeys)
    const nonFixed = colOrder.filter(k => k !== FIXED_LAST_KEY).filter(k => visibleSet.has(k))
    const result: ColKey[] = [...nonFixed]
    if (visibleSet.has(FIXED_LAST_KEY)) result.push(FIXED_LAST_KEY)
    return result
  }, [colOrder, visibleColKeys])

  const columns: ColumnsType<Role> = useMemo(
    () => orderedVisibleKeys.map(k => ALL_COLUMNS[k]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orderedVisibleKeys, statusLoadingId, isXs]
  )

  // —— 过滤 —— //
  const handleReset = async () => {
    setFName('')
    setFCode('')
    setFStatus('')
    setVisibleColKeys(DEFAULT_COL_KEYS)
    setColOrder(DEFAULT_COL_KEYS)
    await load(1, pageSize)
  }

  // ====== 右侧面板 & 树控制 ======
  const [searchKw, setSearchKw] = useState('')
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])
  const [linkage, setLinkage] = useState(true)

  useEffect(() => {
    if (perms.open) {
      setExpandedKeys([])
      setSearchKw('')
    }
  }, [perms.open])

  const allKeys: React.Key[] = useMemo(() => {
    const res: React.Key[] = []
    const walk = (nodes: any[]) => {
      nodes?.forEach(n => {
        res.push(n.key ?? n.id ?? n.value)
        if (n.children?.length) walk(n.children)
      })
    }
    walk(perms.treeData || [])
    return res
  }, [perms.treeData])

  const handleSearchMenu = (kw: string) => {
    setSearchKw(kw)
    if (!kw) {
      setExpandedKeys([])
      return
    }
    const keys: React.Key[] = []
    const travel = (nodes: any[]) => {
      nodes?.forEach(n => {
        if ((n.title || '').toLowerCase().includes(kw.toLowerCase())) {
          keys.push(n.key ?? n.id ?? n.value)
        }
        if (n.children?.length) travel(n.children)
      })
    }
    travel(perms.treeData || [])
    setExpandedKeys(Array.from(new Set(keys)))
  }

  const allExpanded = allKeys.length > 0 && expandedKeys.length === allKeys.length
  const allSelected = allKeys.length > 0 && (perms.selected?.length || 0) === allKeys.length

  // ====== 组件级“覆盖全屏” ======
  const [localFullscreen, setLocalFullscreen] = useState(false)
  const toggleLocalFullscreen = () => setLocalFullscreen(v => !v)

  // 开/关时锁定页面滚动，避免背景滚动
  useEffect(() => {
    if (localFullscreen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [localFullscreen])

  // —— 页码跳转 —— //
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize])
  const [goto, setGoto] = useState<number | null>(null)
  const handleGoto = () => {
    const val = Number(goto)
    if (!Number.isFinite(val)) return
    const target = Math.min(Math.max(1, val), totalPages)
    setPage(target)
    void load(target, pageSize)
  }

  // —— 主体（复用：普通视图 & 全屏视图） —— //
  const MainGrid = (
    <div className={`roles-grid ${perms.open ? 'with-sidebar-padding' : ''}`}>
      <Card styles={{ body: { padding: 12 } }} className="table-card shrinkable-table">
        {/* 工具栏 */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>角色管理</div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Button type="primary" icon={<PlusOutlined />} size="small" onClick={openCreate}>
              新建角色
            </Button>

            <Tooltip title="刷新">
              <Button icon={<ReloadOutlined />} size="small" onClick={() => load(page, pageSize)} />
            </Tooltip>

            <Dropdown
              trigger={['click']}
              menu={{
                selectable: true,
                selectedKeys: [tableSize || 'small'],
                items: [
                  { key: 'large', label: '宽松' },
                  { key: 'middle', label: '默认' },
                  { key: 'small', label: '紧凑' },
                ],
                onClick: ({ key }) => setTableSize(key as TableProps<Role>['size']),
              }}
            >
              <Tooltip title="密度">
                <Button icon={<ColumnHeightOutlined />} size="small" />
              </Tooltip>
            </Dropdown>

            <Dropdown
              trigger={['click']}
              dropdownRender={() => (
                <div className="col-setting-panel" onDragOver={onDragOver}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 12px',
                      backgroundColor: '#fff',
                    }}
                  >
                    <Checkbox
                      checked={visibleColKeys.length === DEFAULT_COL_KEYS.length}
                      indeterminate={visibleColKeys.length > 0 && visibleColKeys.length < DEFAULT_COL_KEYS.length}
                      onChange={e => setVisibleColKeys(e.target.checked ? DEFAULT_COL_KEYS : [])}
                    >
                      列展示
                    </Checkbox>
                    <a
                      onClick={() => {
                        setVisibleColKeys(DEFAULT_COL_KEYS)
                        setColOrder(DEFAULT_COL_KEYS)
                      }}
                    >
                      重置
                    </a>
                  </div>
                  <Divider style={{ margin: '8px 0' }} />
                  <div style={{ paddingBottom: 8 }}>
                    {colOrder.map(k => {
                      const isFixed = k === FIXED_LAST_KEY
                      const checked = visibleColKeys.includes(k)
                      return (
                        <div
                          key={k}
                          className={`col-setting-row ${dragOverKey === k ? 'drag-over' : ''}`}
                          draggable={!isFixed}
                          onDragStart={() => onDragStart(k)}
                          onDragEnter={() => onDragEnter(k)}
                          onDragLeave={() => onDragLeave(k)}
                          onDrop={() => onDrop(k)}
                          aria-grabbed={!isFixed ? undefined : false}
                          title={isFixed ? '固定末列，不能拖拽' : '拖拽调整顺序'}
                        >
                          <HolderOutlined className={`col-setting-handle ${isFixed ? 'handle-disabled' : ''}`} />
                          <Checkbox
                            checked={checked}
                            onChange={e => {
                              setVisibleColKeys(prev =>
                                e.target.checked ? Array.from(new Set([...prev, k])) : prev.filter(x => x !== k)
                              )
                            }}
                          >
                            {LABELS[k]}
                            {isFixed ? (
                              <span style={{ marginLeft: 8, color: '#94a3b8', fontSize: 12 }}>（固定）</span>
                            ) : null}
                          </Checkbox>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            >
              <Tooltip title="列设置">
                <Button icon={<SettingOutlined />} size="small" />
              </Tooltip>
            </Dropdown>

            {/* 局部覆盖全屏切换（通过 Portal 实现，盖住左侧/顶部栏） */}
            <Tooltip title={localFullscreen ? '退出全屏' : '全屏'}>
              <Button
                icon={localFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                size="small"
                onClick={toggleLocalFullscreen}
              />
            </Tooltip>
          </div>
        </div>

        <Table<Role>
          rowKey="id"
          dataSource={list}
          columns={columns}
          loading={loading}
          pagination={false}
          bordered
          size={tableSize}
          tableLayout="fixed"
          sticky
          // ⭐ 关键：给出横向滚动 + 固定操作列才能可见
          scroll={{ x: 980 }}
        />

        {/* 分页 + 前往X页 */}
        <div
          style={{
            marginTop: 10,
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ color: '#6b7280' }}>共 {total} 条</span>
          <Pagination
            current={page}
            total={total}
            pageSize={pageSize}
            showSizeChanger
            showQuickJumper
            simple={isXs} // 小屏更简洁
            pageSizeOptions={['5', '10', '15', '20', '50', '100']}
            onChange={(p, s) => {
              setPage(Number(p) || 1)
              setPageSize(Number(s) || pageSize)
              void load(Number(p) || 1, Number(s) || pageSize)
            }}
            onShowSizeChange={(_p, s) => {
              setPage(1)
              setPageSize(Number(s) || pageSize)
              void load(1, Number(s) || pageSize)
            }}
          />
          {!isXs && (
            <>
              <span style={{ marginLeft: 8, color: '#6b7280' }}>前往</span>
              <InputNumber
                size="middle"
                min={1}
                max={totalPages}
                value={goto ?? page}
                onChange={v => setGoto(Number(v) || null)}
                onPressEnter={handleGoto}
                style={{ width: 72, textAlign: 'center' }}
              />
              <span style={{ color: '#6b7280' }}>页</span>
            </>
          )}
        </div>

        {/* 新建 / 编辑 */}
        <RoleFormModal
          open={formOpen}
          role={
            editingRole
              ? {
                  id: editingRole.id,
                  name: editingRole.name,
                  code: editingRole.code,
                  description: editingRole.description ?? undefined,
                }
              : null
          }
          onCancel={() => setFormOpen(false)}
          onOk={handleSave}
        />
      </Card>

      {/* 右侧权限面板 */}
      <div className={`sidebar-abs ${perms.open ? 'open' : ''}`} aria-hidden={!perms.open}>
        <div className="perm-panel-inner">
          <div
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid #f0f0f0',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minHeight: 44,
              background: '#fff',
              borderTopLeftRadius: 10,
              borderTopRightRadius: 10,
            }}
          >
            <Space size={8}>
              <Tooltip title="关闭">
                <Button type="text" icon={<CloseOutlined />} onClick={() => perms.setOpen(false)} />
              </Tooltip>
              <Tooltip title="保存">
                <Button
                  type="text"
                  icon={<CheckOutlined />}
                  onClick={async () => {
                    await perms.save()
                    message.success('权限已保存')
                  }}
                />
              </Tooltip>
            </Space>

            <div style={{ fontWeight: 600, marginLeft: 8 }}>菜单权限（{perms.role?.name || '未选择'}）</div>
          </div>

          <div style={{ padding: '10px 12px' }}>
            <Input
              allowClear
              placeholder="请输入菜单进行搜索"
              value={searchKw}
              onChange={e => handleSearchMenu(e.target.value.trim())}
              prefix={<SearchOutlined />}
            />
          </div>

          <div style={{ padding: '0 12px 4px 12px' }}>
            <Space size={24} wrap>
              <Checkbox checked={allExpanded} onChange={e => setExpandedKeys(e.target.checked ? allKeys : [])}>
                展开/折叠
              </Checkbox>

              <Checkbox
                checked={allSelected}
                indeterminate={!allSelected && !!perms.selected?.length}
                onChange={e => perms.setSelected(e.target.checked ? toNumberArray(allKeys) : [])}
              >
                全选/全不选
              </Checkbox>

              <Checkbox checked={linkage} onChange={e => setLinkage(e.target.checked)}>
                父子联动
              </Checkbox>
            </Space>
          </div>

          <Divider style={{ margin: '8px 0' }} />

          <div style={{ padding: '0 12px 12px', flex: 1, minHeight: 0 }}>
            {perms.treeData?.length ? (
              <div style={{ height: '100%', overflow: 'auto', paddingRight: 6 }}>
                <Tree
                  blockNode
                  checkable
                  selectable={false}
                  treeData={perms.treeData as any}
                  checkedKeys={perms.selected as any}
                  onCheck={(keys: any) => {
                    const arr = Array.isArray(keys) ? toNumberArray(keys) : toNumberArray(keys.checked || [])
                    perms.setSelected(arr)
                  }}
                  checkStrictly={!linkage}
                  expandedKeys={expandedKeys}
                  onExpand={(keys: any) => setExpandedKeys(keys as React.Key[])}
                />
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无菜单数据" />
            )}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <style>{`
        .roles-grid {
          position: relative;
          display: grid;
          grid-template-columns: 1fr;
          align-items: start;
          column-gap: 12px;
          width: 100%;
        }
        /* 覆盖全屏（通过 Portal 渲染到 body 顶层，盖住左侧/顶部栏） */
        .fs-overlay {
          position: fixed;
          inset: 0;
          z-index: 4000; /* 高于 Header(1000)/Sider(1100) */
          background: #fff;
          overflow: auto;
          padding: 12px;
          box-sizing: border-box;
        }

        .table-card {
          border-radius: 10px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.045);
          min-width: 0;
        }

        /* ✅ 更紧凑的表格行高（thead/tbody） */
        .shrinkable-table .ant-table-thead > tr > th { 
          background-color: #f5f7fa !important;
          text-align: center;
          padding: 6px 8px;       /* 表头高度 ↓ */
          font-weight: 600;
        }
        .shrinkable-table .ant-table-tbody > tr > td { 
          text-align: center; 
          padding: 6px 8px;       /* 行高 ↓ */
        }

        /* ✅ 允许横向滚动（之前有 hidden 导致右侧操作列看不见） */
        .shrinkable-table .ant-table { table-layout: fixed; }
        .shrinkable-table .ant-table-container,
        .shrinkable-table .ant-table-content { overflow-x: auto; }

        .shrinkable-table .ant-table-cell { white-space: nowrap; }

        /* 右侧权限面板（绝对定位，不撑高容器） */
        .sidebar-abs {
          position: absolute;
          top: 0; right: 0;
          width: 0; height: 100%;
          overflow: hidden;
          transition: width 420ms cubic-bezier(0.2, 0, 0, 1);
          will-change: width;
          pointer-events: none;
        }
        .sidebar-abs.open { width: ${PANEL_WIDTH}px; pointer-events: auto; }

        .perm-panel-inner {
          position: absolute; inset: 0;
          display: flex; flex-direction: column;
          background: #fff;
          border: 1px solid #ebeef5;
          border-radius: 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,.06);
          opacity: 0; transform: translateX(12px);
          transition: opacity 360ms ease, transform 360ms ease;
          overflow: auto;
        }
        .sidebar-abs.open .perm-panel-inner { opacity: 1; transform: translateX(0); }

        /* 展开时给表格留出可视空间 */
        .roles-grid.with-sidebar-padding {
          padding-right: ${PANEL_WIDTH + 12}px;
          transition: padding-right 420ms cubic-bezier(0.2, 0, 0, 1);
        }

        /* 列设置面板样式 */
        .col-setting-panel { width: 280px; background: #fff; }
        .col-setting-row { 
          display:flex; align-items:center; gap:8px; padding:6px 12px;
          border-radius: 8px;
          transition: background-color .15s ease;
        }
        .col-setting-row.drag-over { background: #f3f4f6; }
        .col-setting-handle { color:#94a3b8; cursor:grab; }
        .col-setting-handle.handle-disabled { color:#cbd5e1; cursor:not-allowed; }

        @media (max-width: 575.98px) {
          /* 小屏卡片内边距更小 */
          .table-card .ant-card-body { padding: 8px !important; }
        }
      `}</style>

      {/* 顶部查询卡片 */}
      <Card styles={{ body: { padding: 16 } }} style={{ borderRadius: 10, boxShadow: '0 2px 12px rgba(0,0,0,0.045)' }}>
        <Space wrap size={12} style={{ width: '100%' }}>
          <Space>
            <span style={{ width: 72, textAlign: 'right', color: '#6b7280' }}>角色名称：</span>
            <Input
              allowClear
              placeholder="请输入角色名称"
              style={{ width: 220 }}
              value={fName}
              onChange={e => setFName(e.target.value)}
            />
          </Space>
          <Space>
            <span style={{ width: 72, textAlign: 'right', color: '#6b7280' }}>角色标识：</span>
            <Input
              allowClear
              placeholder="请输入角色标识"
              style={{ width: 220 }}
              value={fCode}
              onChange={e => setFCode(e.target.value)}
            />
          </Space>
          <Space>
            <span style={{ width: 56, textAlign: 'right', color: '#6b7280' }}>状态：</span>
            <Select
              placeholder="请选择状态"
              style={{ width: 180 }}
              allowClear
              value={fStatus || undefined}
              options={STATUS_OPTIONS}
              onChange={v => setFStatus((v as RoleStatusFilter) || '')}
            />
          </Space>

          <Space style={{ marginLeft: 'auto' }}>
            <Button type="primary" icon={<SearchOutlined />} onClick={() => load(1, pageSize)} size="small">
              搜索
            </Button>
            <Button onClick={handleReset} icon={<ReloadOutlined />} size="small">
              重置
            </Button>
          </Space>
        </Space>
      </Card>

      {/* 普通模式直接渲染；全屏模式用 Portal 渲染到 body，完全覆盖左侧/顶部栏 */}
      {!localFullscreen ? MainGrid : createPortal(<div className="fs-overlay">{MainGrid}</div>, document.body)}

      {/* 成员管理（保留） */}
      <RoleMembersModal
        open={members.open}
        role={members.role}
        loading={members.loading}
        members={members.members}
        roleOrgs={[]}
        orgsLoading={false}
        onClose={() => members.setOpen(false)}
        onRemove={async id => members.remove(id)}
        onOpenUserSelect={async () => members.openUserSelect()}
        onRefresh={() => (members.role ? members.openFor(members.role) : undefined)}
      />
      <UserSelectModal
        open={members.userOpen}
        loading={members.userLoading}
        users={members.candidateUsers}
        selected={members.selectedIds}
        onChangeSelected={members.setSelectedIds}
        onCancel={() => members.setUserOpen(false)}
        onOk={async () => members.addUsers()}
      />
    </div>
  )
}
