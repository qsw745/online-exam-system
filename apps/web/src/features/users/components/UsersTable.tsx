import { Space, Table, Tag, Button, Dropdown, type MenuProps } from 'antd'
import { EllipsisOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import React, { useMemo } from 'react'
import { translate } from '@/shared/utils/i18n'

export interface User {
  id: number
  username: string
  email: string
  status: 'active' | 'disabled' | string
  orgId?: number
  role?: string
  // ↓ 兼容多种后端字段命名
  department?: string | null
  orgName?: string | null
  orgPath?: string | null
}

export const UsersTable: React.FC<{
  data: User[]
  loading: boolean
  selectedOrgId?: number | null
  /** 用 orgId 计算部门路径（从页面传入：getOrgPath） */
  getOrgPath?: (id?: number | null, fallback?: string | null) => string | null
  onAssignRoles?: (u: any) => void
  onEdit?: (u: any) => void
  onResetPassword?: (u: any) => void
  onToggleStatus?: (u: any) => void
  onUnbind?: (u: any) => void
  onDelete?: (u: any) => void
}> = ({
  data,
  loading,
  onAssignRoles,
  onEdit,
  onResetPassword,
  onToggleStatus,
  onUnbind,
  onDelete,
  selectedOrgId,
  getOrgPath,
}) => {
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
      { title: translate('auth.username'), dataIndex: 'username', key: 'username' },
      { title: translate('auth.email'), dataIndex: 'email', key: 'email' },
      {
        title: translate('users.columns.department'),
        key: 'department',
        render: (_: any, r: User) => {
          // 优先使用返回里自带的 orgPath / department / orgName
          const direct =
            (r.orgPath && String(r.orgPath)) ||
            (r.department && String(r.department)) ||
            (r.orgName && String(r.orgName)) ||
            null
          // 若没有直接字段，用 orgId 通过 getOrgPath 计算
          const byId = getOrgPath?.(r.orgId ?? null, direct)
          return byId || direct || '-'
        },
        ellipsis: true,
      },
      {
        title: translate('users.columns.status'),
        dataIndex: 'status',
        key: 'status',
        render: s => <Tag color={s === 'active' ? 'green' : 'red'}>{s === 'active' ? translate('examPage.proctor.status.ok') : translate('users.status.disable')}</Tag>,
        width: 100,
      },
    ]

    const hasAnyAction = onAssignRoles || onEdit || onResetPassword || onToggleStatus || onUnbind || onDelete
    if (hasAnyAction) {
      base.push({
        title: translate('users.columns.actions'),
        key: 'actions',
        width: 220,
        render: (_: any, r: any) => {
          const editBtn = onEdit ? (
            <Button size="small" onClick={() => onEdit(r)}>
              {translate('app.edit')}</Button>
          ) : null

          const items: MenuProps['items'] = []
          if (onAssignRoles) items.push({ key: 'assign', label: translate('users.action.assign_roles') })
          if (onResetPassword) items.push({ key: 'reset', label: translate('users.action.reset_password') })
          if (onToggleStatus) items.push({ key: 'toggle', label: r.status === 'active' ? '禁用' : '启用' })
          if (selectedOrgId && onUnbind) items.push({ key: 'unbind', label: translate('users.action.remove_from_org') })
          if (onDelete) items.push({ key: 'delete', danger: true, label: translate('app.delete') })

          const hasMore = items.length > 0
          const onMenuClick: MenuProps['onClick'] = ({ key }) => {
            switch (key) {
              case 'assign':
                onAssignRoles?.(r)
                break
              case 'reset':
                onResetPassword?.(r)
                break
              case 'toggle':
                onToggleStatus?.(r)
                break
              case 'unbind':
                onUnbind?.(r)
                break
              case 'delete':
                onDelete?.(r)
                break
            }
          }

          return (
            <Space>
              {editBtn}
              {hasMore && (
                <Dropdown trigger={['click']} menu={{ items, onClick: onMenuClick }} placement="bottomRight">
                  <Button size="small" icon={<EllipsisOutlined />} />
                </Dropdown>
              )}
            </Space>
          )
        },
      })
    }
    return base
  }, [onAssignRoles, onEdit, onResetPassword, onToggleStatus, onUnbind, onDelete, selectedOrgId, getOrgPath])

  return <Table<User> rowKey="id" loading={loading} dataSource={dedupedData} columns={columns} pagination={false} />
}
