// src/features/users/components/UsersTable.tsx
import { Space, Table, Tag, Button } from 'antd'
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
  onAssignRoles?: (u: any) => void
  onEdit?: (u: any) => void
  onResetPassword?: (u: any) => void // <- 用它打开弹窗
  onToggleStatus?: (u: any) => void
  onUnbind?: (u: any) => void
  onDelete?: (u: any) => void
}> = ({ data, loading, onAssignRoles, onEdit, onResetPassword, onToggleStatus, onUnbind, onDelete, selectedOrgId }) => {
  const dedupedData = useMemo(() => {
    const map = new Map<number, User>()
    for (let i = data.length - 1; i >= 0; i--) {
      const row = data[i]
      if (row && typeof row.id === 'number' && !map.has(row.id)) map.set(row.id, row)
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

    const hasActions = onAssignRoles || onEdit || onResetPassword || onToggleStatus || onUnbind || onDelete
    if (hasActions) {
      base.push({
        title: '操作',
        key: 'actions',
        width: 540,
        render: (_: any, r: any) => (
          <Space wrap>
            {onAssignRoles && (
              <Button size="small" type="primary" onClick={() => onAssignRoles(r)}>
                分配角色
              </Button>
            )}
            {onEdit && (
              <Button size="small" onClick={() => onEdit(r)}>
                编辑
              </Button>
            )}
            {onResetPassword && (
              <Button size="small" onClick={() => onResetPassword(r)}>
                重置密码
              </Button>
            )}
            {onToggleStatus && (
              <Button
                size="small"
                type={r.status === 'active' ? 'default' : 'primary'}
                onClick={() => onToggleStatus(r)}
              >
                {r.status === 'active' ? '禁用' : '启用'}
              </Button>
            )}
            {selectedOrgId && onUnbind && (
              <Button size="small" danger onClick={() => onUnbind(r)}>
                从机构移除
              </Button>
            )}
            {onDelete && (
              <Button size="small" danger onClick={() => onDelete(r)}>
                删除
              </Button>
            )}
          </Space>
        ),
      })
    }
    return base
  }, [onAssignRoles, onEdit, onResetPassword, onToggleStatus, onUnbind, onDelete, selectedOrgId])

  return <Table<User> rowKey="id" loading={loading} dataSource={dedupedData} columns={columns} pagination={false} />
}
