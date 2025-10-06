// apps/web/src/features/logs/pages/OnlineUsersPage.tsx
import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { App, Button, Card, Popconfirm, Table, Typography } from 'antd'
import { LogOut, RefreshCw } from 'lucide-react'
import dayjs from '@/shared/utils/dayjs'
import { api } from '@/shared/api/http'
import OnlineUsersFiltersBar from '@/features/logs/components/OnlineUsersFiltersBar'

type OnlineUser = {
  id: number | string
  username: string
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

function pickLocation(r: OnlineUser) {
  return r.location || r.geo || [r.country, r.province || r.region, r.city].filter(Boolean).join('') || '-'
}
function pickOS(r: OnlineUser) {
  return r.client?.os || r.os || '-'
}
function pickBrowser(r: OnlineUser) {
  return r.client?.browser || r.browser || '-'
}
function pickKickId(r: OnlineUser) {
  return r.session_id ?? r.token ?? r.id
}

export default function OnlineUsersPage() {
  const { message } = App.useApp()
  const [rows, setRows] = useState<OnlineUser[]>([])
  const [loading, setLoading] = useState(false)

  // ✅ 筛选面板：只需要用户名
  const [filters, setFilters] = useState<{ username?: string }>({ username: '' })

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get('/logs/online', {
        params: {
          username: (filters.username || '').trim() || undefined, // 只有有值才传
        },
      })
      const data = (res as any)?.data ?? res
      const list: OnlineUser[] = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []
      setRows(list)
    } catch (e) {
      console.error(e)
      message.error('获取在线用户失败')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [filters, message])

  const kick = async (row: OnlineUser) => {
    const id = pickKickId(row)
    if (id == null) return message.error('无法识别会话ID')
    try {
      await api.post('/logs/online/kick', { id })
    } catch {
      try {
        await api.delete(`/logs/online/${id}`)
      } catch (e) {
        console.error(e)
        message.error('强退失败')
        return
      }
    }
    message.success('已强退')
    load()
  }

  useEffect(() => {
    load()
  }, [load])

  const columns = useMemo(
    () => [
      {
        title: '序号',
        width: 80,
        align: 'center' as const,
        render: (_: any, __: OnlineUser, i: number) => i + 1,
      },
      { title: '用户名', dataIndex: 'username', width: 180 },
      { title: '登录 IP', dataIndex: 'ip_address', width: 180 },
      {
        title: '登录地点',
        width: 240,
        render: (_: any, r: OnlineUser) => pickLocation(r),
      },
      {
        title: '操作系统',
        width: 140,
        render: (_: any, r: OnlineUser) => pickOS(r),
      },
      {
        title: '浏览器类型',
        width: 160,
        render: (_: any, r: OnlineUser) => pickBrowser(r),
      },
      {
        title: '登录时间',
        dataIndex: 'login_time',
        width: 200,
        render: (t?: string) => (t ? dayjs(t).format('YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: '操作',
        width: 100,
        fixed: 'right' as const,
        render: (_: any, r: OnlineUser) => (
          <Popconfirm title="确认强退该用户？" onConfirm={() => kick(r)} okText="强退" cancelText="取消">
            <Button type="link" icon={<LogOut style={{ width: 16, height: 16 }} />}>
              强退
            </Button>
          </Popconfirm>
        ),
      },
    ],
    []
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Title level={2} style={{ margin: 0 }}>
          在线用户
        </Title>
    
      </div>

      {/* 🔹 顶部筛选面板（与截图一致） */}
      <Card style={{ marginBottom: 12, }}>
        <OnlineUsersFiltersBar
          username={filters.username || ''}
          onUsernameChange={v => setFilters(prev => ({ ...prev, username: v }))}
          onSearch={() => load()}
          onReset={() => {
            setFilters({ username: '' })
            load()
          }}
          loading={loading}
        />
      </Card>

      <Card>
        <Table<OnlineUser>
          rowKey={r => String(pickKickId(r))}
          loading={loading}
          dataSource={rows}
          pagination={false}
          size="small"
          tableLayout="fixed"
          columns={columns as any}
          scroll={{ x: 1200 }}
        />
      </Card>
    </div>
  )
}
