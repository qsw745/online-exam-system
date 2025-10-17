import { orgsApi } from '@/shared/api/endpoints/orgs'
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

// ✅ 弹窗组件
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
  | 'username'
  | 'nickname'
  | 'gender'
  | 'department'
  | 'phone'
  | 'status'
  | 'created_at'
  | 'actions'

type Row = {
  id: number
  username?: string
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
  username: '用户名',
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
  'username',
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

// ✅ 手机号敏感化
const maskPhone = (p?: string | null) => (p ? p.replace(/^(\d{3})\d*(\d{4})$/, '$1****$2') : '—')

const toEnabled = (s?: string) => (s === 'active' ? true : s === 'disabled' ? false : undefined)
const created = (r: Row) => r.created_at || r.createdAt || null
const genderTag = (g?: Row['gender']) => {
  if (g === '男') return <Tag>男</Tag>
  if (g === '女') return <Tag>女</Tag>
  if (g === '保密') return <Tag>保密</Tag>
  return <Text type="secondary">—</Text>
}

const avatarUrl = (r: Row) => r.avatar_url || r.avatar || null

/** ✅ 按 id 去重 */
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

/** ✅ 统一的创建用户函数：强制走 usersApi.create（会自动带 token） */
async function safeCreateUser(payload: SubmitPayload) {
  return usersApi.create(payload) // ← 不再使用裸 fetch，避免 401
}

export default function UserManagementPage() {
  const { message } = App.useApp()

  // ===== 左侧机构树 =====
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

  // org 路径映射
  const orgPathMap = useOrgPathMap(tree)
  const getOrgPath = (id?: number | null, fb?: string | null) => (id ? orgPathMap.get(id) || fb || null : fb || null)

  // ===== 右侧用户列表查询 =====
  const q = useOrgUsersQuery(selectedOrgId)

  // ===== 顶部筛选 =====
  const [fUsername, setFUsername] = useState('')
  const [fNickname, setFNickname] = useState('')
  const [fPhone, setFPhone] = useState('')
  const [fStatus, setFStatus] = useState<'' | 'active' | 'disabled'>('')

  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([])

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

  // ===== 表格工具条：密度 / 列设置 / 全屏 =====
  const [tableSize, setTableSize] = useState<'small' | 'middle' | 'large'>('middle')

  // 列顺序（不含 actions）
  const [order, setOrder] = useState<ColKey[]>(DEFAULT_ORDER)
  const [visible, setVisible] = useState<ColKey[]>(DEFAULT_VISIBLE)
  const allChecked = visible.length === DEFAULT_VISIBLE.length
  const indeterminate = visible.length > 0 && !allChecked

  // 拖拽（仅非固定列）
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

  // ===== 行操作 =====
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
    const ok = u.status === 'active' ? '已禁用' : '已启用'
    App.useApp().message?.success?.(`状态${ok}`)
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
      content: '删除后不可恢复',
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

  // ===== 列定义 =====
  const columns = useMemo<ColumnsType<Row>>(() => {
    const ALL: Record<ColKey, any> = {
      id: { title: LABELS.id, dataIndex: 'id', width: 90, align: 'center' },
      avatar: {
        title: LABELS.avatar,
        key: 'avatar',
        width: 78,
        align: 'center',
        render: (_: any, r: Row) => {
          const url = avatarUrl(r)
          const txt = (r.nickname || r.real_name || r.username || '').trim().slice(-2) || '用户'
          return url ? (
            <Avatar src={url} />
          ) : (
            <Avatar icon={<UserOutlined />} alt={txt}>
              {txt}
            </Avatar>
          )
        },
      },
      username: { title: LABELS.username, dataIndex: 'username', ellipsis: true, width: 120 },
      nickname: {
        title: LABELS.nickname,
        dataIndex: 'nickname',
        ellipsis: true,
        width: 100,
        render: (t: any, r: Row) => t || r.real_name || <Text type="secondary">—</Text>,
      },
      gender: {
        title: LABELS.gender,
        key: 'gender',
        width: 80,
        align: 'center',
        render: (_: any, r: Row) => genderTag(r.gender),
      },
      department: {
        title: LABELS.department,
        key: 'department',
        width: 220,
        ellipsis: true,
        render: (_: any, r: Row) => {
          const direct =
            (r.orgPath && String(r.orgPath)) ||
            (r.department && String(r.department)) ||
            (r.orgName && String(r.orgName)) ||
            null
          const id = (r.orgId ?? r.org_id) as number | undefined
          return getOrgPath(id ?? null, direct) || direct || <Text type="secondary">—</Text>
        },
      },
      phone: { title: LABELS.phone, dataIndex: 'phone', width: 140, align: 'center', render: (p: any) => maskPhone(p) },
      status: {
        title: LABELS.status,
        dataIndex: 'status',
        width: 100,
        align: 'center',
        render: (s: any) => <Tag color={toEnabled(s) ? 'green' : 'red'}>{toEnabled(s) ? '已启用' : '停用'}</Tag>,
      },
      created_at: {
        title: LABELS.created_at,
        key: 'created_at',
        width: 180,
        align: 'center',
        render: (_: any, r: Row) => {
          const t = created(r)
          return t ? new Date(t).toLocaleString() : '—'
        },
      },
      actions: {
        title: LABELS.actions,
        key: 'actions',
        width: 220,
        align: 'center',
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

  // ✅ 对 q.rows 做去重后再给 Table
  const dataSource = useUniqueRows((q.rows || []) as Row[])

  // ===== 工具栏、筛选、表格 =====
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
          popupRender={() => (
            <div className="col-setting-panel">
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px' }}
              >
                <Checkbox
                  checked={visible.length === DEFAULT_VISIBLE.length}
                  indeterminate={visible.length > 0 && visible.length < DEFAULT_VISIBLE.length}
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

  const Filters = (
    <Card
      styles={{ body: { padding: 16, overflowX: 'auto' } }}
      style={{ borderRadius: 10, boxShadow: '0 2px 12px rgba(0,0,0,0.045)' }}
    >
      <Space wrap size={16} style={{ width: '100%' }}>
        <Space>
          <span style={{ width: 72, textAlign: 'right', color: '#6b7280' }}>用户名：</span>
          <Input
            allowClear
            placeholder="输入用户名"
            style={{ width: 220 }}
            value={fUsername}
            onChange={e => setFUsername(e.target.value)}
          />
        </Space>
        <Space>
          <span style={{ width: 72, textAlign: 'right', color: '#6b7280' }}>用户昵称：</span>
          <Input
            allowClear
            placeholder="输入昵称"
            style={{ width: 220 }}
            value={fNickname}
            onChange={e => setFNickname(e.target.value)}
          />
        </Space>
        <Space>
          <span style={{ width: 72, textAlign: 'right', color: '#6b7280' }}>手机号：</span>
          <Input
            allowClear
            placeholder="输入手机号"
            style={{ width: 220 }}
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
              { label: '停用', value: 'disabled' },
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
    <Card className="users-table-card" styles={{ body: { padding: 12, overflowX: 'auto' } }}>
      {Toolbar}
      <Table<Row>
        className="users-table"
        rowKey={r => r.id as Key}
        dataSource={dataSource}
        loading={q.loading}
        columns={columns}
        pagination={false}
        size={tableSize}
        scroll={{ x: 'max-content' }}
        rowSelection={{ selectedRowKeys, onChange: keys => setSelectedRowKeys(keys), preserveSelectedRowKeys: true }}
        bordered
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, alignItems: 'center', gap: 12 }}>
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

      {/* —— 编辑 —— */}
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

      {/* —— 新增用户 —— */}
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

      {/* —— 重置密码 —— */}
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

      {/* —— 分配角色 —— */}
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
