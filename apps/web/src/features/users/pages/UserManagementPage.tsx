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
import React, { useCallback, useEffect, useMemo, useRef, useState, type Key } from 'react'
import { createPortal } from 'react-dom'

// 弹窗
import AssignRolesModal from '../components/AssignRolesModal'
import AddUserModal, { type SubmitPayload } from '../components/AddUserModal'
import { EditUserModal } from '../components/EditUserModal'
import { ResetPasswordModal } from '../components/ResetPasswordModal'
import { UploadAvatarModal } from '../components/UploadAvatarModal'

import { useOrgPathMap } from '../hooks/useOrgPathMap'
import { useOrgUsersQuery } from '../hooks/useOrgUsersQuery'
import { useLanguage } from '@/shared/contexts/LanguageContext'

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

const COLUMN_LABEL_KEYS: Record<ColKey, string> = {
  id: 'users.columns.id',
  avatar: 'users.columns.avatar',
  email: 'users.columns.email',
  nickname: 'users.columns.nickname',
  gender: 'users.columns.gender',
  department: 'users.columns.department',
  phone: 'users.columns.phone',
  status: 'users.columns.status',
  created_at: 'users.columns.created_at',
  actions: 'users.columns.actions',
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
const avatarUrl = (r: Row) => r.avatar_url || r.avatar || null

// 纯函数：去重
function dedupeRows(rows: Row[] | undefined | null): Row[] {
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
}

async function safeCreateUser(payload: SubmitPayload) {
  return usersApi.create(payload as any)
}

/** 统一解包批量删除响应：兼容 data 包裹与直返两种形式 */
function normalizeBatchDeleteResult(ret: any): { deleted: number; skipped: number; rawMsg?: string } {
  const data = ret && (ret.deleted !== undefined || ret.skipped !== undefined) ? ret : ret?.data || ret?.result || {}
  const deleted = Number(data?.deleted ?? 0)
  const skipped = Array.isArray(data?.skipped) ? data.skipped.length : Number((data?.skipped ?? 0) || 0)
  const rawMsg = typeof ret?.message === 'string' ? ret.message : undefined
  return { deleted, skipped, rawMsg }
}

export default function UserManagementPage() {
  // ✅ 仅在顶层调用一次 Hook
  const { message } = App.useApp()
  const { t } = useLanguage()

  const formatMessage = useCallback((template: string, vars: Record<string, string | number> = {}) => {
    if (!template) return ''
    return template.replace(/\{(\w+)\}/g, (_, key) => (vars[key] !== undefined ? String(vars[key]) : ''))
  }, [])

  const labels = useMemo<Record<ColKey, string>>(() => {
    const entries = {} as Record<ColKey, string>
    ;(Object.keys(COLUMN_LABEL_KEYS) as ColKey[]).forEach(key => {
      entries[key] = t(COLUMN_LABEL_KEYS[key])
    })
    return entries
  }, [t])

  const renderGenderTag = useCallback(
    (g?: Row['gender']) => {
      if (!g) return ''
      if (g === '男' || g === 'male') return <Tag>{t('users.gender.male')}</Tag>
      if (g === '女' || g === 'female') return <Tag>{t('users.gender.female')}</Tag>
      return <Tag>{t('users.gender.secret')}</Tag>
    },
    [t]
  )

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
    q.setFilters({
      email: fUsername.trim() || undefined,
      nickname: fNickname.trim() || undefined,
      phone: fPhone.trim() || undefined,
    })
    q.setKeyword('')
    q.setPage(1)
    q.setStatus(fStatus || undefined)
    setSelectedRowKeys([])
  }
  const doReset = () => {
    setFUsername('')
    setFNickname('')
    setFPhone('')
    setFStatus('')
    q.setFilters({})
    q.setKeyword('')
    q.setStatus(undefined)
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
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState<any | null>(null)

  const onEdit = async (u: any) => {
    const detail = await q.getUserDetail(u.id).catch(() => u)
    setCurrentUser(detail || u)
    setEditOpen(true)
  }
  const onAssignRoles = (u: any) => (setCurrentUser(u), setAssignOpen(true))
  const onReset = (u: any) => (setCurrentUser(u), setResetOpen(true))
  const onUploadAvatar = (u: any) => (setCurrentUser(u), setAvatarOpen(true))
  const onToggle = async (u: any) => {
    await q.toggleStatus(u.id, u.status === 'active' ? 'disabled' : 'active')
    // ❌ 禁止在回调里再次调用 App.useApp()
    message.success(u.status === 'active' ? t('users.message.status_disabled') : t('users.message.status_enabled'))
    q.refetch()
  }
  const onUnbind = async (u: any) => {
    if (!selectedOrgId) return
    await q.unbind(selectedOrgId, u.id)
    message.success(t('users.message.removed_org'))
    q.refetch()
  }
  const onDelete = async (u: any) => {
    Modal.confirm({
      title: t('users.modal.delete_title'),
      okButtonProps: { danger: true },
      okText: t('users.action.delete'),
      onOk: async () => {
        await q.deleteUser(u.id)
        message.success(t('users.message.delete_success'))
        const rest = q.total - 1 - (q.page - 1) * q.limit
        if (rest <= 0 && q.page > 1) q.setPage(q.page - 1)
        else q.refetch()
      },
    })
  }
  const openAddModal = () => {
    if (!selectedOrgId) return message.warning(t('users.message.select_org'))
    setAddOpen(true)
  }

  // 批量删除
  const onBatchDelete = () => {
    if (selectedRowKeys.length === 0 || batchLoading) return
    Modal.confirm({
      title: formatMessage(t('users.modal.batch_delete_title'), { count: selectedRowKeys.length }),
      okText: t('users.action.batch_delete'),
      okButtonProps: { danger: true, loading: batchLoading },
      onOk: async () => {
        const ids = selectedRowKeys.map(k => Number(k)).filter(n => Number.isFinite(n)) as number[]
        if (!ids.length) return
        setBatchLoading(true)
        try {
          const ret = await usersApi.batchDelete(ids)
          const { deleted, skipped, rawMsg } = normalizeBatchDeleteResult(ret)
          if (skipped > 0) {
            message.warning(
              rawMsg || formatMessage(t('users.message.batch_warning'), { deleted, skipped })
            )
          } else {
            message.success(rawMsg || formatMessage(t('users.message.batch_success'), { deleted }))
          }
          const rest = q.total - deleted - (q.page - 1) * q.limit
          setSelectedRowKeys([])
          if (rest <= 0 && q.page > 1) {
            q.setPage(q.page - 1)
          } else {
            q.refetch()
          }
        } catch (e: any) {
          message.error(e?.message || t('users.message.batch_failed'))
        } finally {
          setBatchLoading(false)
        }
      },
    })
  }

  // 列
  const columns = useMemo<ColumnsType<Row>>(() => {
    const ALL: Record<ColKey, any> = {
      id: { title: labels.id, dataIndex: 'id', width: 80, align: 'center' },
      avatar: {
        title: labels.avatar,
        key: 'avatar',
        width: 70,
        align: 'center',
        render: (_: any, r: Row) => {
          const url = avatarUrl(r)
          const txt = (r.nickname || r.real_name || '').trim().slice(-2) || t('users.tag.user')
          return url ? (
            <Avatar src={url} />
          ) : (
            <Avatar icon={<UserOutlined />} alt={txt}>
              {txt}
            </Avatar>
          )
        },
      },
      email: { title: labels.email, dataIndex: 'email', ellipsis: true, width: 180, render: (t: any) => t || '' },
      nickname: {
        title: labels.nickname,
        dataIndex: 'nickname',
        ellipsis: true,
        width: 140,
        render: (t: any, r: Row) => t || r.real_name || '',
      },
      gender: {
        title: labels.gender,
        key: 'gender',
        width: 80,
        align: 'center',
        render: (_: any, r: Row) => renderGenderTag(r.gender) || '',
      },
      department: {
        title: labels.department,
        key: 'department',
        width: 240,
        ellipsis: true,
        render: (_: any, r: Row) => {
          const direct =
            (r.orgPath && String(r.orgPath)) ||
            (r.department && String(r.department)) ||
            (r.orgName && String(r.orgName)) ||
            null
          const rawId = (r.orgId ?? r.org_id) as number | null | undefined
          const id = Number.isFinite(Number(rawId)) ? Number(rawId) : undefined
          const mapped = getOrgPath(id ?? null, direct)
          return mapped || <Text type="secondary">{t('users.tag.unassigned')}</Text>
        },
      },
      phone: { title: labels.phone, dataIndex: 'phone', width: 130, align: 'center', render: (p: any) => maskPhone(p) },
      status: {
        title: labels.status,
        dataIndex: 'status',
        width: 150,
        align: 'center',
        render: (_s: any, r: Row) => {
          const checked = toEnabled(r.status)
          return (
            <Switch
              checkedChildren={t('users.status.switch_enabled')}
              unCheckedChildren={t('users.status.switch_disabled')}
              checked={!!checked}
              onChange={() => onToggle(r)}
            />
          )
        },
      },
      created_at: {
        title: labels.created_at,
        key: 'created_at',
        width: 170,
        align: 'center',
        render: (_: any, r: Row) => {
          const t = created(r)
          return t ? new Date(t).toLocaleString() : ''
        },
      },
      actions: {
        title: labels.actions,
        key: 'actions',
        width: 160,
        align: 'center',
        fixed: 'right',
        onCell: () => ({ className: 'users-actions-cell', style: { background: '#fff' } }),
        onHeaderCell: () => ({ className: 'users-actions-cell', style: { background: '#fff' } }),
        render: (_: any, r: Row) => {
          const items = [
            { key: 'assign', label: t('users.action.assign_roles') },
            { key: 'reset', label: t('users.action.reset_password') },
            { key: 'uploadAvatar', label: t('users.action.upload_avatar') },
            { key: 'toggle', label: r.status === 'active' ? t('users.action.disable') : t('users.action.enable') },
            ...(selectedOrgId ? [{ key: 'unbind', label: t('users.action.remove_from_org') }] : []),
            { type: 'divider' as const },
            { key: 'delete', label: t('users.action.delete'), danger: true },
          ]
          return (
            <Space size="small">
              <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(r)}>
                {t('users.action.edit')}
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
                      case 'uploadAvatar':
                        onUploadAvatar(r)
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
  }, [orderedVisibleKeys, selectedOrgId, labels, renderGenderTag, getOrgPath, t])

  // 先去重，再做二次映射
  const baseRows = useMemo<Row[]>(() => dedupeRows((q.rows || []) as Row[]), [q.rows])
  const dataSource = useMemo<Row[]>(
    () =>
      baseRows.map(r => {
        const orgId = r.orgId ?? r.org_id ?? null
        return orgId === r.orgId ? r : { ...r, orgId }
      }),
    [baseRows]
  )

  // UI
  const allChecked = visible.length === DEFAULT_VISIBLE.length
  const indeterminate = visible.length > 0 && !allChecked

  const Toolbar = (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
      <div style={{ fontWeight: 600, fontSize: 16 }}>{t('users.title')}</div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Button type="primary" icon={<UserAddOutlined />} onClick={openAddModal} disabled={!selectedOrgId}>
          {t('users.button.add')}
        </Button>
        <Tooltip title={siderCollapsed ? t('users.tooltip.expand_org') : t('users.tooltip.collapse_org')}>
          <Button
            icon={siderCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setSiderCollapsed(v => !v)}
          />
        </Tooltip>
        <Tooltip title={t('app.refresh')}>
          <Button icon={<ReloadOutlined />} onClick={() => q.refetch()} />
        </Tooltip>
        <Dropdown
          trigger={['click']}
          menu={{
            selectable: true,
            selectedKeys: [tableSize],
            items: [
              { key: 'large', label: t('users.density.loose') },
              { key: 'middle', label: t('users.density.default') },
              { key: 'small', label: t('users.density.compact') },
            ],
            onClick: ({ key }) => setTableSize(key as any),
          }}
        >
          <Tooltip title={t('users.tooltip.density')}>
            <Button icon={<ColumnHeightOutlined />} />
          </Tooltip>
        </Dropdown>

        <Dropdown
          trigger={['click']}
          menu={{ items: [] }}
          // ⛳️ antd 新 API：用 popupRender 替代 dropdownRender
          popupRender={() => (
            <div className="col-setting-panel">
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px' }}
              >
                <Checkbox
                  checked={allChecked}
                  indeterminate={indeterminate}
                  onChange={e => setVisible(e.target.checked ? DEFAULT_VISIBLE : [])}
                >
                  {t('users.columns.panel_title')}
                </Checkbox>
                <a
                  onClick={() => {
                    setOrder(DEFAULT_ORDER)
                    setVisible(DEFAULT_VISIBLE)
                  }}
                >
                  {t('users.columns.reset')}
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
                      {labels[k]}
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
                    {labels.actions}（{t('users.columns.fixed')}）
                  </Checkbox>
                </div>
              </div>
            </div>
          )}
        >
          <Tooltip title={t('users.tooltip.column_settings')}>
            <Button icon={<SettingOutlined />} />
          </Tooltip>
        </Dropdown>

        <Tooltip title={fs ? t('users.tooltip.exit_fullscreen') : t('users.tooltip.fullscreen')}>
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
          <Text>{formatMessage(t('users.selection.count'), { count: selectedRowKeys.length })}</Text>
          <a onClick={() => setSelectedRowKeys([])}>{t('users.selection.clear')}</a>
        </Space>
        <Button danger onClick={onBatchDelete} loading={batchLoading}>
          {t('users.action.batch_delete')}
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
          <span style={{ width: 72, textAlign: 'right', color: '#6b7280' }}>{t('users.filters.email_label')}</span>
          <Input
            allowClear
            placeholder={t('users.filters.email_placeholder')}
            style={{ width: 200 }}
            value={fUsername}
            onChange={e => setFUsername(e.target.value)}
          />
        </Space>
        <Space>
          <span style={{ width: 72, textAlign: 'right', color: '#6b7280' }}>{t('users.filters.nickname_label')}</span>
          <Input
            allowClear
            placeholder={t('users.filters.nickname_placeholder')}
            style={{ width: 200 }}
            value={fNickname}
            onChange={e => setFNickname(e.target.value)}
          />
        </Space>
        <Space>
          <span style={{ width: 72, textAlign: 'right', color: '#6b7280' }}>{t('users.filters.phone_label')}</span>
          <Input
            allowClear
            placeholder={t('users.filters.phone_placeholder')}
            style={{ width: 200 }}
            value={fPhone}
            onChange={e => setFPhone(e.target.value)}
          />
        </Space>
        <Space>
          <span style={{ width: 56, textAlign: 'right', color: '#6b7280' }}>{t('users.filters.status_label')}</span>
          <Select
            allowClear
            placeholder={t('users.filters.status_placeholder')}
            style={{ width: 160 }}
            value={fStatus || undefined}
            options={[
              { label: t('users.status.enabled'), value: 'active' },
              { label: t('users.status.disabled'), value: 'disabled' },
            ]}
            onChange={v => setFStatus((v as any) || '')}
          />
        </Space>
        <Space style={{ marginLeft: 'auto' }} align="center">
          <Button type="primary" icon={<SearchOutlined />} onClick={doSearch}>
            {t('app.search')}
          </Button>
          <Button icon={<ReloadOutlined />} onClick={doReset}>
            {t('app.reset')}
          </Button>
          <Text type="secondary">{t('users.filters.include_children')}</Text>
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
        <span style={{ color: '#6b7280' }}>{formatMessage(t('users.pagination.total'), { count: q.total })}</span>
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
            title={t('users.org_tree.title')}
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
          message.success(t('users.message.update_success'))
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
          message.success(t('users.message.reset_success'))
          q.refetch()
        }}
      />

      {/* 上传头像 */}
      <UploadAvatarModal
        open={avatarOpen}
        user={currentUser ?? undefined}
        loading={avatarLoading}
        onCancel={() => {
          if (!avatarLoading) setAvatarOpen(false)
        }}
        onSubmit={async file => {
          if (!currentUser) return
          setAvatarLoading(true)
          try {
            await q.uploadAvatar(currentUser.id, file)
            message.success(t('users.message.avatar_success'))
            setAvatarOpen(false)
            q.refetch()
          } catch (e: any) {
            message.error(e?.message || t('users.message.avatar_failed'))
          } finally {
            setAvatarLoading(false)
          }
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
