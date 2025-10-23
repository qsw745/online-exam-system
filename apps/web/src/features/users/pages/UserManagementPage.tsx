// === 完整可复制：UserManagementPage.tsx ===
import { usersApi } from '@/shared/api/endpoints/users'
import { OrgTreePanel } from '@/shared/components/OrgTreePanel'
import { useOrgTree } from '@/shared/hooks'
import {
  ColumnHeightOutlined,
  EditOutlined,
  EllipsisOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  HolderOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  UserAddOutlined,
  UserOutlined,
} from '@ant-design/icons'
import {
  App,
  Avatar,
  Button,
  Card,
  Checkbox,
  Dropdown,
  Input,
  Layout,
  Modal,
  Pagination,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import React, { useEffect, useMemo, useRef, useState, type Key } from 'react'
import { createPortal } from 'react-dom'

// 弹窗
import AssignRolesModal from '../components/AssignRolesModal'
import AddUserModal, { type SubmitPayload } from '../components/AddUserModal'
import { EditUserModal } from '../components/EditUserModal'
import { ResetPasswordModal } from '../components/ResetPasswordModal'

import { useOrgPathMap } from '../hooks/useOrgPathMap'
import { useOrgUsersQuery } from '../hooks/useOrgUsersQuery'

const { Sider, Content } = Layout
const { Text } = Typography

type Status = 'active' | 'disabled'
type ColKey =
  | 'id'
  | 'avatar'
  | 'email'
  | 'nickname'
  | 'gender'
  | 'department'
  | 'phone'
  | 'status'
  | 'created_at'
  | 'actions'

type Row = {
  id: number
  nickname?: string
  real_name?: string
  gender?: 'male' | 'female' | '男' | '女' | string | null
  phone?: string | null
  email?: string | null
  status?: Status | string
  avatar?: string | null
  avatar_url?: string | null
  orgId?: number | null
  org_id?: number | null
  orgPath?: string | null
  department?: string | null
  orgName?: string | null
  created_at?: string | null
  createdAt?: string | null
}

const LABELS: Record<ColKey, string> = {
  id: '用户编号',
  avatar: '用户头像',
  email: '邮箱',
  nickname: '用户昵称',
  gender: '性别',
  department: '部门',
  phone: '手机号码',
  status: '状态',
  created_at: '创建时间',
  actions: '操作',
}
const FIXED: ColKey = 'actions'
const DEFAULT_ORDER: ColKey[] = [
  'id',
  'avatar',
  'email',
  'nickname',
  'gender',
  'department',
  'phone',
  'status',
  'created_at',
]
const DEFAULT_VISIBLE: ColKey[] = [...DEFAULT_ORDER, 'actions']

function pickFirstId(tree: any[]): number | null {
  if (!Array.isArray(tree) || tree.length === 0) return null
  const first = tree.find(n => n && typeof n.id === 'number')
  return first ? first.id : null
}
const maskPhone = (p?: string | null) => (p ? p.replace(/^(\d{3})\d*(\d{4})$/, '$1****$2') : '')
const toEnabled = (s?: string) => (s === 'active' ? true : s === 'disabled' ? false : undefined)
const created = (r: Row) => r.created_at || r.createdAt || null
const genderTag = (g?: Row['gender']) => {
  if (!g) return ''
  if (g === '男' || g === 'male') return <Tag>男</Tag>
  if (g === '女' || g === 'female') return <Tag>女</Tag>
  return <Tag>保密</Tag>
}
const avatarUrl = (r: Row) => r.avatar_url || r.avatar || null

function useUniqueRows(rows: Row[] | undefined | null) {
  return useMemo<Row[]>(() => {
    if (!Array.isArray(rows) || rows.length === 0) return []
    const seen = new Set<number>()
    const uniq: Row[] = []
    for (const r of rows) {
      const idNum = Number((r as any)?.id)
      if (Number.isFinite(idNum)) {
        if (seen.has(idNum)) continue
        seen.add(idNum)
      }
      uniq.push(r)
    }
    return uniq
  }, [rows])
}

async function safeCreateUser(payload: SubmitPayload) {
  return usersApi.create(payload as any)
}

/** 统一解包批量删除响应：兼容 data 包裹与直返两种形式 */
function normalizeBatchDeleteResult(ret: any): { deleted: number; skipped: number; rawMsg?: string } {
  // 兼容后端通用包裹：{ success, message, data:{deleted,skipped} }
  const data = ret && (ret.deleted !== undefined || ret.skipped !== undefined) ? ret : ret?.data || ret?.result || {}
  const deleted = Number(data?.deleted ?? 0)
  const skipped = Array.isArray(data?.skipped) ? data.skipped.length : Number((data?.skipped ?? 0) || 0)
  const rawMsg = typeof ret?.message === 'string' ? ret.message : undefined
  return { deleted, skipped, rawMsg }
}

export default function UserManagementPage() {
  const { message } = App.useApp()

  // 左侧机构树
  const { tree, loading: treeLoading, refetch: refetchTree } = useOrgTree()
  const [siderCollapsed, setSiderCollapsed] = useState(false)
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null)

  useEffect(() => {
    ;(async () => {
      const next = await refetchTree()
      const first = pickFirstId((next as any[]) || [])
      if (first != null) {
        setExpandedKeys([first])
        setSelectedOrgId(first)
      }
    })()
  }, [refetchTree])

  // 右侧查询
  const orgPathMap = useOrgPathMap(tree)
  const getOrgPath = (id?: number | null, fb?: string | null) => (id ? orgPathMap.get(id) || fb || null : fb || null)
  const q = useOrgUsersQuery(selectedOrgId)

  // 筛选
  const [fUsername, setFUsername] = useState('')
  const [fNickname, setFNickname] = useState('')
  const [fPhone, setFPhone] = useState('')
  const [fStatus, setFStatus] = useState<'' | 'active' | 'disabled'>('')
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([])
  const [batchLoading, setBatchLoading] = useState(false)

  const doSearch = () => {
    const parts = [fUsername.trim(), fNickname.trim(), fPhone.trim()].filter(Boolean)
    q.setKeyword(parts.join(' '))
    q.setPage(1)
    if (fStatus) q.setRole(fStatus)
    setSelectedRowKeys([])
  }
  const doReset = () => {
    setFUsername('')
    setFNickname('')
    setFPhone('')
    setFStatus('')
    q.setKeyword('')
    q.setRole(undefined)
    q.setPage(1)
    setSelectedRowKeys([])
  }

  // 工具条
  const [tableSize, setTableSize] = useState<'small' | 'middle' | 'large'>('small')
  const [order, setOrder] = useState<ColKey[]>(DEFAULT_ORDER)
  const [visible, setVisible] = useState<ColKey[]>(DEFAULT_VISIBLE)
  const dragKeyRef = useRef<ColKey | null>(null)
  const onDragStart = (k: ColKey) => (e: React.DragEvent) => {
    dragKeyRef.current = k
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', k)
  }
  const onDragOver = () => (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }
  const move = (arr: ColKey[], from: number, to: number) => {
    const a = [...arr]
    const it = a.splice(from, 1)[0]
    a.splice(to, 0, it)
    return a
  }
  const onDrop = (target: ColKey) => (e: React.DragEvent) => {
    e.preventDefault()
    const fromKey = dragKeyRef.current
    dragKeyRef.current = null
    if (!fromKey || fromKey === target) return
    const from = order.indexOf(fromKey)
    const to = order.indexOf(target)
    if (from === -1 || to === -1) return
    setOrder(move(order, from, to))
  }

  const orderedVisibleKeys = useMemo<ColKey[]>(() => {
    const nonFixed = order.filter(k => visible.includes(k))
    const res = [...nonFixed]
    if (visible.includes(FIXED)) res.push(FIXED)
    return res
  }, [order, visible])

  // 全屏
  const [fs, setFs] = useState(false)
  useEffect(() => {
    if (fs) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [fs])

  // 行操作
  const [editOpen, setEditOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<any | null>(null)

  const onEdit = async (u: any) => {
    const detail = await q.getUserDetail(u.id).catch(() => u)
    setCurrentUser(detail || u)
    setEditOpen(true)
  }
  const onAssignRoles = (u: any) => (setCurrentUser(u), setAssignOpen(true))
  const onReset = (u: any) => (setCurrentUser(u), setResetOpen(true))
  const onToggle = async (u: any) => {
    await q.toggleStatus(u.id, u.status === 'active' ? 'disabled' : 'active')
    App.useApp().message?.success?.(u.status === 'active' ? '状态已禁用' : '状态已启用')
    q.refetch()
  }
  const onUnbind = async (u: any) => {
    if (!selectedOrgId) return
    await q.unbind(selectedOrgId, u.id)
    App.useApp().message?.success?.('已从机构移除')
    q.refetch()
  }
  const onDelete = async (u: any) => {
    Modal.confirm({
      title: '确定要删除该用户吗？',
      okButtonProps: { danger: true },
      okText: '删除',
      onOk: async () => {
        await q.deleteUser(u.id)
        App.useApp().message?.success?.('删除成功')
        const rest = q.total - 1 - (q.page - 1) * q.limit
        if (rest <= 0 && q.page > 1) q.setPage(q.page - 1)
        else q.refetch()
      },
    })
  }
  const openAddModal = () => {
    if (!selectedOrgId) return App.useApp().message?.warning?.('请先选择左侧机构')
    setAddOpen(true)
  }

  // 批量删除：走后端 /users/batch-delete，并兼容多种响应结构
  const onBatchDelete = () => {
    if (selectedRowKeys.length === 0 || batchLoading) return
    Modal.confirm({
      title: `确定批量删除选中的 ${selectedRowKeys.length} 个用户吗？`,
      okText: '批量删除',
      okButtonProps: { danger: true, loading: batchLoading },
      onOk: async () => {
        const ids = selectedRowKeys.map(k => Number(k)).filter(n => Number.isFinite(n)) as number[]
        if (!ids.length) return
        setBatchLoading(true)
        try {
          const ret = await usersApi.batchDelete(ids)
          const { deleted, skipped, rawMsg } = normalizeBatchDeleteResult(ret)

          // 成功提示优先使用后端 message
          if (skipped > 0) {
            message.warning(rawMsg || `已删除 ${deleted} 个，跳过管理员 ${skipped} 个`)
          } else {
            message.success(rawMsg || `已删除 ${deleted} 个`)
          }

          // 页码与刷新：用真实 deleted 数来计算是否需要回退页
          const rest = q.total - deleted - (q.page - 1) * q.limit
          setSelectedRowKeys([])
          if (rest <= 0 && q.page > 1) {
            q.setPage(q.page - 1)
          } else {
            q.refetch()
          }
        } catch (e: any) {
          message.error(e?.message || '批量删除失败')
        } finally {
          setBatchLoading(false)
        }
      },
    })
  }

  // 列
  const columns = useMemo<ColumnsType<Row>>(() => {
    const ALL: Record<ColKey, any> = {
      id: { title: LABELS.id, dataIndex: 'id', width: 80, align: 'center' },
      avatar: {
        title: LABELS.avatar,
        key: 'avatar',
        width: 70,
        align: 'center',
        render: (_: any, r: Row) => {
          const url = avatarUrl(r)
          const txt = (r.nickname || r.real_name || '').trim().slice(-2) || '用户'
          return url ? (
            <Avatar src={url} />
          ) : (
            <Avatar icon={<UserOutlined />} alt={txt}>
              {txt}
            </Avatar>
          )
        },
      },
      email: { title: LABELS.email, dataIndex: 'email', ellipsis: true, width: 140, render: (t: any) => t || '' },
      nickname: {
        title: LABELS.nickname,
        dataIndex: 'nickname',
        ellipsis: true,
        width: 110,
        render: (t: any, r: Row) => t || r.real_name || '',
      },
      gender: {
        title: LABELS.gender,
        key: 'gender',
        width: 80,
        align: 'center',
        render: (_: any, r: Row) => genderTag(r.gender) || '',
      },
      department: {
        title: LABELS.department,
        key: 'department',
        width: 200,
        ellipsis: true,
        render: (_: any, r: Row) => {
          const direct =
            (r.orgPath && String(r.orgPath)) ||
            (r.department && String(r.department)) ||
            (r.orgName && String(r.orgName)) ||
            null
          const id = (r.orgId ?? r.org_id) as number | undefined
          const v = getOrgPath(id ?? null, direct) || direct
          return v || ''
        },
      },
      phone: { title: LABELS.phone, dataIndex: 'phone', width: 130, align: 'center', render: (p: any) => maskPhone(p) },
      status: {
        title: LABELS.status,
        dataIndex: 'status',
        width: 150,
        align: 'center',
        render: (_s: any, r: Row) => {
          const checked = toEnabled(r.status)
          return (
            <Switch
              checkedChildren="已启用"
              unCheckedChildren="已禁用"
              checked={!!checked}
              onChange={() => onToggle(r)}
            />
          )
        },
      },
      created_at: {
        title: LABELS.created_at,
        key: 'created_at',
        width: 170,
        align: 'center',
        render: (_: any, r: Row) => {
          const t = created(r)
          return t ? new Date(t).toLocaleString() : ''
        },
      },
      actions: {
        title: LABELS.actions,
        key: 'actions',
        width: 220,
        align: 'center',
        fixed: 'right',
        onCell: () => ({ className: 'users-actions-cell', style: { background: '#fff' } }),
        onHeaderCell: () => ({ className: 'users-actions-cell', style: { background: '#fff' } }),
        render: (_: any, r: Row) => {
          const items = [
            { key: 'assign', label: '分配角色' },
            { key: 'reset', label: '重置密码' },
            { key: 'toggle', label: r.status === 'active' ? '禁用' : '启用' },
            ...(selectedOrgId ? [{ key: 'unbind', label: '从机构移除' }] : []),
            { type: 'divider' as const },
            { key: 'delete', label: '删除', danger: true },
          ]
          return (
            <Space size="small">
              <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(r)}>
                修改
              </Button>
              <Dropdown
                trigger={['click']}
                menu={{
                  items,
                  onClick: ({ key }) => {
                    switch (key) {
                      case 'assign':
                        onAssignRoles(r)
                        break
                      case 'reset':
                        onReset(r)
                        break
                      case 'toggle':
                        onToggle(r)
                        break
                      case 'unbind':
                        onUnbind(r)
                        break
                      case 'delete':
                        onDelete(r)
                        break
                    }
                  },
                }}
              >
                <Button size="small" icon={<EllipsisOutlined />} />
              </Dropdown>
            </Space>
          )
        },
      },
    }
    return orderedVisibleKeys.map(k => ALL[k])
  }, [orderedVisibleKeys, selectedOrgId])

  const dataSource = useUniqueRows((q.rows || []) as Row[])

  // UI
  const allChecked = visible.length === DEFAULT_VISIBLE.length
  const indeterminate = visible.length > 0 && !allChecked

  const Toolbar = (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
      <div style={{ fontWeight: 600, fontSize: 16 }}>用户管理</div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Button type="primary" icon={<UserAddOutlined />} onClick={openAddModal} disabled={!selectedOrgId}>
          新增用户
        </Button>
        <Tooltip title={siderCollapsed ? '展开机构树' : '折叠机构树'}>
          <Button
            icon={siderCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setSiderCollapsed(v => !v)}
          />
        </Tooltip>
        <Tooltip title="刷新">
          <Button icon={<ReloadOutlined />} onClick={() => q.refetch()} />
        </Tooltip>
        <Dropdown
          trigger={['click']}
          menu={{
            selectable: true,
            selectedKeys: [tableSize],
            items: [
              { key: 'large', label: '宽松' },
              { key: 'middle', label: '默认' },
              { key: 'small', label: '紧凑' },
            ],
            onClick: ({ key }) => setTableSize(key as any),
          }}
        >
          <Tooltip title="密度">
            <Button icon={<ColumnHeightOutlined />} />
          </Tooltip>
        </Dropdown>

        <Dropdown
          trigger={['click']}
          menu={{ items: [] }}
          dropdownRender={() => (
            <div className="col-setting-panel">
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px' }}
              >
                <Checkbox
                  checked={allChecked}
                  indeterminate={indeterminate}
                  onChange={e => setVisible(e.target.checked ? DEFAULT_VISIBLE : [])}
                >
                  列展示
                </Checkbox>
                <a
                  onClick={() => {
                    setOrder(DEFAULT_ORDER)
                    setVisible(DEFAULT_VISIBLE)
                  }}
                >
                  重置
                </a>
              </div>
              <div style={{ padding: '6px 12px 0' }}>
                {order.map(k => (
                  <div
                    key={k}
                    className="col-setting-row"
                    draggable
                    onDragStart={onDragStart(k)}
                    onDragOver={onDragOver()}
                    onDrop={onDrop(k)}
                  >
                    <HolderOutlined className="col-setting-handle" />
                    <Checkbox
                      checked={visible.includes(k)}
                      onChange={e => setVisible(prev => (e.target.checked ? [...prev, k] : prev.filter(x => x !== k)))}
                    >
                      {LABELS[k]}
                    </Checkbox>
                  </div>
                ))}
                <div className="col-setting-row col-fixed">
                  <HolderOutlined className="col-setting-handle disabled" />
                  <Checkbox
                    checked={visible.includes('actions')}
                    onChange={e =>
                      setVisible(prev => (e.target.checked ? [...prev, 'actions'] : prev.filter(x => x !== 'actions')))
                    }
                  >
                    {LABELS.actions}（固定）
                  </Checkbox>
                </div>
              </div>
            </div>
          )}
        >
          <Tooltip title="列设置">
            <Button icon={<SettingOutlined />} />
          </Tooltip>
        </Dropdown>

        <Tooltip title={fs ? '退出全屏' : '全屏'}>
          <Button icon={fs ? <FullscreenExitOutlined /> : <FullscreenOutlined />} onClick={() => setFs(v => !v)} />
        </Tooltip>
      </div>
    </div>
  )

  const SelectionBar =
    selectedRowKeys.length > 0 ? (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          border: '1px solid #f0f0f0',
          borderRadius: 8,
          background: '#fafafa',
          marginBottom: 8,
        }}
      >
        <Space>
          <Text>已选 {selectedRowKeys.length} 项</Text>
          <a onClick={() => setSelectedRowKeys([])}>取消选择</a>
        </Space>
        <Button danger onClick={onBatchDelete} loading={batchLoading}>
          批量删除
        </Button>
      </div>
    ) : null

  const Filters = (
    <Card
      styles={{ body: { padding: 12, overflowX: 'auto' } }}
      style={{ borderRadius: 10, boxShadow: '0 2px 12px rgba(0,0,0,0.045)' }}
    >
      <Space wrap size={12} style={{ width: '100%' }}>
        <Space>
          <span style={{ width: 72, textAlign: 'right', color: '#6b7280' }}>邮箱：</span>
          <Input
            allowClear
            placeholder="输入邮箱"
            style={{ width: 200 }}
            value={fUsername}
            onChange={e => setFUsername(e.target.value)}
          />
        </Space>
        <Space>
          <span style={{ width: 72, textAlign: 'right', color: '#6b7280' }}>用户昵称：</span>
          <Input
            allowClear
            placeholder="输入昵称"
            style={{ width: 200 }}
            value={fNickname}
            onChange={e => setFNickname(e.target.value)}
          />
        </Space>
        <Space>
          <span style={{ width: 72, textAlign: 'right', color: '#6b7280' }}>手机号：</span>
          <Input
            allowClear
            placeholder="输入手机号"
            style={{ width: 200 }}
            value={fPhone}
            onChange={e => setFPhone(e.target.value)}
          />
        </Space>
        <Space>
          <span style={{ width: 56, textAlign: 'right', color: '#6b7280' }}>状态：</span>
          <Select
            allowClear
            placeholder="请选择"
            style={{ width: 160 }}
            value={fStatus || undefined}
            options={[
              { label: '已启用', value: 'active' },
              { label: '已禁用', value: 'disabled' },
            ]}
            onChange={v => setFStatus((v as any) || '')}
          />
        </Space>
        <Space style={{ marginLeft: 'auto' }} align="center">
          <Button type="primary" icon={<SearchOutlined />} onClick={doSearch}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={doReset}>
            重置
          </Button>
          <Text type="secondary">含子部门</Text>
          <Switch
            checked={!!q.includeChildren}
            onChange={v => {
              q.setIncludeChildren(v)
              q.setPage(1)
              setSelectedRowKeys([])
            }}
          />
        </Space>
      </Space>
    </Card>
  )

  const TableBlock = (
    <Card className="users-table-card" styles={{ body: { padding: 10, overflowX: 'auto' } }}>
      {Toolbar}
      {SelectionBar}
      <Table<Row>
        className="users-table"
        rowKey={r => r.id as Key}
        dataSource={dataSource}
        loading={q.loading}
        columns={columns}
        pagination={false}
        size={tableSize}
        scroll={{ x: 1200 }}
        rowSelection={{ selectedRowKeys, onChange: keys => setSelectedRowKeys(keys), preserveSelectedRowKeys: true }}
        bordered
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, alignItems: 'center', gap: 12 }}>
        <span style={{ color: '#6b7280' }}>共 {q.total} 条</span>
        <Pagination
          current={q.page}
          pageSize={q.limit}
          total={q.total}
          showSizeChanger
          showQuickJumper
          onChange={(p, ps) => {
            if (ps !== q.limit) q.setPage(1)
            else q.setPage(p)
            q.setLimit(ps)
            setSelectedRowKeys([])
          }}
        />
      </div>
    </Card>
  )

  return (
    <Layout style={{ height: '100%', background: 'transparent', padding: 16 }}>
      <style>{`
        .users-table-card { border-radius:10px; box-shadow:0 2px 12px rgba(0,0,0,0.045); }
        .users-table .ant-table-thead > tr > th { background-color:#f5f7fa !important; text-align:center; }
        .users-table .ant-table-tbody > tr > td { text-align:left; }
        .col-setting-panel { width:260px; background:#fff; border:1px solid #f0f0f0; border-radius:8px; box-shadow:0 8px 24px rgba(0,0,0,.06); user-select:none; padding-bottom:6px; }
        .col-setting-row { display:flex; align-items:center; gap:8px; padding:6px 4px; border-radius:8px; }
        .col-setting-handle { color:#94a3b8; cursor:grab; }
        .col-setting-handle.disabled { opacity:.35; cursor:not-allowed; }
        .fs-overlay { position:fixed; inset:0; z-index:4000; background:#fff; overflow:auto; padding:12px; box-sizing:border-box; }
        /* 固定右侧列白底（防透明） */
        .users-table td.ant-table-cell-fix-right,
        .users-table th.ant-table-cell-fix-right,
        .users-table .ant-table-cell.ant-table-cell-fix-right,
        .users-table .users-actions-cell { background:#fff !important; }
        .users-table .ant-table-cell-fix-right-first::after { pointer-events:none; }
        /* 紧凑内边距 */
        .users-table .ant-table-tbody > tr > td,
        .users-table .ant-table-thead > tr > th { padding-top:8px; padding-bottom:8px; }
      `}</style>

      <Sider
        width={240}
        collapsedWidth={0}
        collapsible
        collapsed={siderCollapsed}
        trigger={null}
        theme="light"
        style={{ borderRight: '1px solid #f0f0f0', marginRight: 16, background: '#fff' }}
      >
        <div style={{ padding: 12 }}>
          <OrgTreePanel
            tree={tree as any}
            loading={treeLoading}
            expandedKeys={expandedKeys}
            setExpandedKeys={setExpandedKeys}
            selectedOrgId={selectedOrgId}
            onSelect={id => {
              setSelectedOrgId(id)
              q.setPage(1)
              setSelectedRowKeys([])
            }}
            onRefresh={async () => {
              const next = (await refetchTree()) as any[]
              const first = pickFirstId(next || [])
              if (first != null) {
                setExpandedKeys([first])
                if (selectedOrgId == null) setSelectedOrgId(first)
              }
            }}
            title="机构"
          />
        </div>
      </Sider>

      <Content style={{ minWidth: 0 }}>
        {Filters}
        {!fs ? TableBlock : createPortal(<div className="fs-overlay">{TableBlock}</div>, document.body)}
      </Content>

      {/* 编辑 */}
      <EditUserModal
        open={editOpen}
        user={currentUser}
        tree={tree}
        onCancel={() => setEditOpen(false)}
        onSubmit={async (v: any) => {
          if (!currentUser) return
          await q.update(currentUser.id, v)
          setEditOpen(false)
          message.success('用户已更新')
          q.refetch()
        }}
      />

      {/* 新增 */}
      <AddUserModal
        open={addOpen}
        defaultOrgId={selectedOrgId ?? undefined}
        onCancel={() => setAddOpen(false)}
        onSubmit={async payload => {
          await safeCreateUser(payload)
          setAddOpen(false)
          q.refetch()
        }}
      />

      {/* 重置密码 */}
      <ResetPasswordModal
        open={resetOpen}
        username={currentUser?.username}
        onCancel={() => setResetOpen(false)}
        onSubmit={async (newPwd: any) => {
          if (!currentUser) return
          await q.resetPassword(currentUser.id, newPwd)
          setResetOpen(false)
          message.success('密码已重置')
          q.refetch()
        }}
      />

      {/* 分配角色 */}
      <AssignRolesModal
        open={assignOpen}
        user={currentUser}
        orgId={selectedOrgId ?? undefined}
        onCancel={() => setAssignOpen(false)}
        onOk={() => {
          setAssignOpen(false)
          q.refetch()
        }}
      />
    </Layout>
  )
}
