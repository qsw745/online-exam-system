import { Popconfirm, Space, Table, Tag, Button } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import React, { useMemo } from 'react'

export interface User {
  id: number
  username: string
  email: string
  status: 'active' | 'disabled' | string
  orgId?: number
  role?: string
}

export const UsersTable: React.FC<{
  data: User[]
  loading: boolean
  selectedOrgId?: number | null
  onView?: (u: any) => void
  onEdit?: (u: any) => void
  onResetPassword?: (u: any) => void
  onToggleStatus?: (u: any) => void
  onUnbind?: (u: any) => void
  onDelete?: (u: any) => void
}> = ({ data, loading, onView, onEdit, onResetPassword, onToggleStatus, onUnbind, onDelete, selectedOrgId }) => {
  // —— 关键修复：按 id 去重，保留“最后一次出现”的那条 —— //
  const dedupedData = useMemo(() => {
    const map = new Map<number, User>()
    for (let i = data.length - 1; i >= 0; i--) {
      const row = data[i]
      if (row && typeof row.id === 'number' && !map.has(row.id)) {
        map.set(row.id, row)
      }
    }
    return Array.from(map.values()).reverse()
  }, [data])

  const columns: ColumnsType<User> = useMemo(() => {
    const base: ColumnsType<User> = [
      { title: '用户名', dataIndex: 'username', key: 'username' },
      { title: '邮箱', dataIndex: 'email', key: 'email' },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        render: s => <Tag color={s === 'active' ? 'green' : 'red'}>{s === 'active' ? '正常' : '禁用'}</Tag>,
        width: 100,
      },
    ]

    const hasActions = onView || onEdit || onResetPassword || onToggleStatus || onUnbind || onDelete

    if (hasActions) {
      base.push({
        title: '操作',
        key: 'actions',
        width: 420,
        render: (_: any, r: any) => (
          <Space wrap>
            {onView && (
              <Button size="small" onClick={() => onView(r)}>
                查看
              </Button>
            )}
            {onEdit && (
              <Button size="small" onClick={() => onEdit(r)}>
                编辑
              </Button>
            )}
            {onResetPassword && (
              <Popconfirm title="确定重置密码？" onConfirm={() => onResetPassword(r)}>
                <Button size="small">重置密码</Button>
              </Popconfirm>
            )}
            {onToggleStatus && (
              <Popconfirm
                title={`确定${r.status === 'active' ? '禁用' : '启用'}该用户？`}
                onConfirm={() => onToggleStatus(r)}
              >
                <Button size="small" type={r.status === 'active' ? 'default' : 'primary'}>
                  {r.status === 'active' ? '禁用' : '启用'}
                </Button>
              </Popconfirm>
            )}
            {selectedOrgId && onUnbind && (
              <Popconfirm title="从当前机构移除该用户？" onConfirm={() => onUnbind(r)}>
                <Button size="small" danger>
                  从机构移除
                </Button>
              </Popconfirm>
            )}
            {onDelete && (
              <Popconfirm title="确定删除该用户？" onConfirm={() => onDelete(r)}>
                <Button size="small" danger>
                  删除
                </Button>
              </Popconfirm>
            )}
          </Space>
        ),
      })
    }

    return base
  }, [onView, onEdit, onResetPassword, onToggleStatus, onUnbind, onDelete, selectedOrgId])

  return <Table<User> rowKey="id" loading={loading} dataSource={dedupedData} columns={columns} pagination={false} />
}
