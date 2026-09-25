import OnlineUsersFiltersBar from '@/features/logs/components/OnlineUsersFiltersBar'
import { api } from '@/shared/api/http'
import dayjs from '@/shared/utils/dayjs'
import { App, Button, Card, Checkbox, Dropdown, Popconfirm, Space, Table, Typography } from 'antd'
import {
  ReloadOutlined,
  ColumnHeightOutlined,
  SettingOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  HolderOutlined,
} from '@ant-design/icons'
import { LogOut } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { translate } from '@/shared/utils/i18n'
import { formatDateTime } from '@/shared/utils/datetime'

type OnlineUser = {
  id: number | string
  email: string
  ip_address?: string
  login_time?: string
  location?: string
  geo?: string
  country?: string
  province?: string
  region?: string
  city?: string
  client?: { os?: string; browser?: string }
  os?: string
  browser?: string
  session_id?: string
  token?: string
}

const { Title } = Typography

const pickLocation = (r: OnlineUser) =>
  r.location || r.geo || [r.country, r.province || r.region, r.city].filter(Boolean).join('') || '-'
const pickOS = (r: OnlineUser) => r.client?.os || r.os || '-'
const pickBrowser = (r: OnlineUser) => r.client?.browser || r.browser || '-'
const pickKickId = (r: OnlineUser) => r.session_id ?? r.token ?? r.id

type ColKey = 'index' | 'email' | 'ip_address' | 'location' | 'os' | 'browser' | 'login_time' | 'actions'

const LABELS: Record<ColKey, string> = {
  index: '序号',
  email: '邮箱',
  ip_address: '登录 IP',
  location: '登录地点',
  os: '操作系统',
  browser: '浏览器类型',
  login_time: '登录时间',
  actions: '操作',
}

const DEFAULT_ORDER: ColKey[] = ['index', 'email', 'ip_address', 'location', 'os', 'browser', 'login_time']
const DEFAULT_VISIBLE: ColKey[] = [...DEFAULT_ORDER, 'actions']
const FIXED: ColKey = 'actions'

export default function OnlineUsersPage() {
  const { message } = App.useApp()
  const [rows, setRows] = useState<OnlineUser[]>([])
  const [loading, setLoading] = useState(false)

  // ✅ 顶部筛选：邮箱（为兼容 OnlineUsersFiltersBar 的 props 名，这里仍复用 username 字段）
  const [filters, setFilters] = useState<{ email?: string }>({ email: '' })

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get('/logs/online', {
        params: { email: (filters.email || '').trim() || undefined },
      })
      const data = (res as any)?.data ?? res
      const list: OnlineUser[] = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []
      setRows(list)
    } catch (e) {
      console.error(e)
      message.error(translate('auto.fa0fcb050e'))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [filters, message])

  const kick = useCallback(
    async (row: OnlineUser) => {
      const id = pickKickId(row)
      if (id == null) return message.error(translate('auto.b9872e2319'))
      try {
        await api.post('/logs/online/kick', { id })
      } catch {
        try {
          await api.delete(`/logs/online/${id}`)
        } catch (e) {
          console.error(e)
          message.error(translate('auto.030a53ce03'))
          return
        }
      }
      message.success(translate('auto.9c7b989fdb'))
      load()
    },
    [load, message]
  )

  useEffect(() => {
    load()
  }, [load])

  // ===== 表格：密度 / 列设置 / 全屏 =====
  const [tableSize, setTableSize] = useState<'small' | 'middle' | 'large'>('middle')
  const [order, setOrder] = useState<ColKey[]>(DEFAULT_ORDER) // 不含 actions
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
  const onDrop = (target: ColKey) => (e: React.DragEvent) => {
    e.preventDefault()
    const fromKey = dragKeyRef.current
    dragKeyRef.current = null
    if (!fromKey || fromKey === target) return
    const arr = [...order]
    const from = arr.indexOf(fromKey)
    const to = arr.indexOf(target)
    if (from === -1 || to === -1) return
    const it = arr.splice(from, 1)[0]
    arr.splice(to, 0, it)
    setOrder(arr)
  }

  const orderedVisibleKeys = useMemo<ColKey[]>(() => {
    const nonFixed = order.filter(k => visible.includes(k))
    const res = [...nonFixed]
    if (visible.includes(FIXED)) res.push(FIXED)
    return res
  }, [order, visible])

  const [fs, setFs] = useState(false)
  useEffect(() => {
    if (!fs) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [fs])

  // ===== 列定义 =====
  const columns = useMemo(() => {
    const ALL: Record<ColKey, any> = {
      index: { title: LABELS.index, width: 80, align: 'center', render: (_: any, __: OnlineUser, i: number) => i + 1 },
      email: { title: LABELS.email, dataIndex: 'email', width: 220 },
      ip_address: { title: LABELS.ip_address, dataIndex: 'ip_address', width: 180 },
      location: { title: LABELS.location, width: 240, render: (_: any, r: OnlineUser) => pickLocation(r) },
      os: { title: LABELS.os, width: 140, render: (_: any, r: OnlineUser) => pickOS(r) },
      browser: { title: LABELS.browser, width: 160, render: (_: any, r: OnlineUser) => pickBrowser(r) },
      login_time: {
        title: LABELS.login_time,
        dataIndex: 'login_time',
        width: 200,
        render: (t?: string) => (t ? formatDateTime(t) : '-'),
      },
      actions: {
        title: LABELS.actions,
        width: 100,
        fixed: 'right' as const,
        onHeaderCell: () => ({ className: 'online-ops-fixed-white' }),
        onCell: () => ({ className: 'online-ops-fixed-white' }),
        render: (_: any, r: OnlineUser) => (
          <Popconfirm title={translate('auto.00ef0a25d0')} onConfirm={() => kick(r)} okText={translate('auto.11e95fb130')} cancelText={translate('app.cancel')}>
            <Button type="link" icon={<LogOut style={{ width: 16, height: 16 }} />}>
              {translate('auto.11e95fb130')}</Button>
          </Popconfirm>
        ),
      },
    }
    return orderedVisibleKeys.map(k => ALL[k])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedVisibleKeys, kick])

  // ===== 工具条 =====
  const Toolbar = (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
      <div style={{ fontWeight: 600, fontSize: 16 }}>{translate('menus.system-logs-online')}</div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Button icon={<ReloadOutlined />} onClick={load} />
        <Dropdown
          trigger={['click']}
          menu={{
            selectable: true,
            selectedKeys: [tableSize],
            items: [
              { key: 'large', label: translate('table.density.loose') },
              { key: 'middle', label: translate('table.density.default') },
              { key: 'small', label: translate('table.density.compact') },
            ],
            onClick: ({ key }) => setTableSize(key as any),
          }}
        >
          <Button icon={<ColumnHeightOutlined />} />
        </Dropdown>
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
                  checked={visible.length === DEFAULT_VISIBLE.length}
                  indeterminate={visible.length > 0 && visible.length < DEFAULT_VISIBLE.length}
                  onChange={e => setVisible(e.target.checked ? DEFAULT_VISIBLE : [])}
                >
                  {translate('table.columns.title')}</Checkbox>
                <a
                  onClick={() => {
                    setOrder(DEFAULT_ORDER)
                    setVisible(DEFAULT_VISIBLE)
                  }}
                >
                  {translate('app.reset')}</a>
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
                    {LABELS.actions}{translate('table.columns.fixed_suffix')}</Checkbox>
                </div>
              </div>
            </div>
          )}
        >
          <Button icon={<SettingOutlined />} />
        </Dropdown>
        <Button icon={fs ? <FullscreenExitOutlined /> : <FullscreenOutlined />} onClick={() => setFs(v => !v)} />
      </div>
    </div>
  )

  const TableBlock = (
    <Card styles={{ body: { padding: 12 } }}>
      {Toolbar}
      <Table<OnlineUser>
        className="online-users-table"
        rowKey={r => String(pickKickId(r))}
        loading={loading}
        dataSource={rows}
        pagination={false}
        size={tableSize}
        tableLayout="fixed"
        columns={columns as any}
        scroll={{ x: 1200 }}
        bordered={false}
      />
    </Card>
  )

  return (
    <div style={{ padding: 0 }}>
      <style>{`
        .online-users-table .ant-table-thead > tr > th { background: #f6f7fa !important; }
        .online-users-table .ant-table-cell-fix-right,
        .online-users-table .ant-table-cell-fix-right-first,
        .online-users-table .online-ops-fixed-white { background: #fff !important; }
        .online-users-table .ant-table-cell-fix-right-first::after {
          background: linear-gradient(to left, rgba(0,0,0,0.06), rgba(0,0,0,0)) !important;
        }
        .col-setting-panel { width:260px; background:#fff; border:1px solid #f0f0f0; border-radius:8px; box-shadow:0 8px 24px rgba(0,0,0,.06); user-select:none; padding-bottom:6px; }
        .col-setting-row { display:flex; align-items:center; gap:8px; padding:6px 4px; border-radius:8px; }
        .col-setting-handle { color:#94a3b8; cursor:grab; }
        .col-setting-handle.disabled { opacity:.35; cursor:not-allowed; }
        .fs-overlay { position:fixed; inset:0; z-index:4000; background:#fff; overflow:auto; padding:12px; box-sizing:border-box; }
      `}</style>

      {/* 顶部筛选面板（props 仍使用 username 名称以兼容组件，实际传的是邮箱值） */}
      <Card style={{ marginBottom: 12 }}>
        <OnlineUsersFiltersBar
          username={filters.email || ''} // ← 传入邮箱值
          onUsernameChange={v => setFilters(prev => ({ ...prev, email: v }))}
          onSearch={() => load()}
          onReset={() => {
            setFilters({ email: '' })
            load()
          }}
          loading={loading}
        />
      </Card>

      {!fs ? TableBlock : createPortal(<div className="fs-overlay">{TableBlock}</div>, document.body)}
    </div>
  )
}
