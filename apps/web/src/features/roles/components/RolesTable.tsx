// src/features/roles/components/RolesTable.tsx
import { Button, Dropdown, Modal, Space, Table, Tag } from 'antd'
import { DeleteOutlined, EditOutlined, MoreOutlined, SettingOutlined, TeamOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import React from 'react'
import type { Role } from '@/shared/api/endpoints/roles'
import { translate } from '@/shared/utils/i18n'
import { formatDateTime } from '@/shared/utils/datetime'

export function RolesTable({
  data,
  loading,
  onEdit,
  onDelete,
  onPermission,
  onMembers,
}: {
  data: Role[]
  loading: boolean
  onEdit: (r: Role) => void
  onDelete: (r: Role) => void
  onPermission: (r: Role) => void
  onMembers: (r: Role) => void
}) {
  const columns: ColumnsType<Role> = [
    {
      title: translate('roles.columns.name'),
      dataIndex: 'name',
      render: (t, r) => (
        <Space>
          {t}
          {r.is_system && <Tag color="blue">{translate('auto.97946d6335')}</Tag>}
          {r.is_disabled && <Tag color="red">{translate('users.status.disabled')}</Tag>}
        </Space>
      ),
    },
    { title: translate('auto.c12ace673d'), dataIndex: 'code' },
    { title: translate('papers.desc2'), dataIndex: 'description', ellipsis: true },
    { title: translate('users.columns.created_at'), dataIndex: 'created_at', render: t => (t ? formatDateTime(t) : '-') },
    {
      title: translate('users.columns.actions'),
      width: 140,
      render: (_, record) => {
        const items = [
          { key: 'edit', icon: <EditOutlined />, label: translate('app.edit'), onClick: () => onEdit(record) },
          { key: 'perm', icon: <SettingOutlined />, label: translate('auto.6a05416758'), onClick: () => onPermission(record) },
          { key: 'members', icon: <TeamOutlined />, label: translate('auto.4f965d4969'), onClick: () => onMembers(record) },
          !record.is_system && {
            key: 'del',
            danger: true,
            icon: <DeleteOutlined />,
            label: translate('app.delete'),
            onClick: () =>
              Modal.confirm({
                title: translate('roles.confirm.delete_title'),
                content: translate('roles.confirm.delete_content'),
                onOk: () => onDelete(record),
              }),
          },
        ].filter(Boolean) as any[]
        return (
          <Space size={0}>
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => onEdit(record)} />
            <Dropdown menu={{ items }} trigger={['hover', 'click']} placement="bottomRight">
              <Button type="link" size="small" icon={<MoreOutlined />} />
            </Dropdown>
          </Space>
        )
      },
    },
  ]
  return <Table columns={columns} dataSource={data} rowKey="id" loading={loading} pagination={false} />
}
