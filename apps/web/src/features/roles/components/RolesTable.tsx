// src/features/roles/components/RolesTable.tsx
import { Button, Dropdown, Modal, Space, Table, Tag } from 'antd'
import { DeleteOutlined, EditOutlined, MoreOutlined, SettingOutlined, TeamOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import React from 'react'
import type { Role } from '@/shared/api/endpoints/roles'

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
      title: '角色名称',
      dataIndex: 'name',
      render: (t, r) => (
        <Space>
          {t}
          {r.is_system && <Tag color="blue">系统角色</Tag>}
          {r.is_disabled && <Tag color="red">已禁用</Tag>}
        </Space>
      ),
    },
    { title: '角色编码', dataIndex: 'code' },
    { title: '描述', dataIndex: 'description', ellipsis: true },
    { title: '创建时间', dataIndex: 'created_at', render: t => new Date(t).toLocaleString() },
    {
      title: '操作',
      width: 140,
      render: (_, record) => {
        const items = [
          { key: 'edit', icon: <EditOutlined />, label: '编辑', onClick: () => onEdit(record) },
          { key: 'perm', icon: <SettingOutlined />, label: '权限设置', onClick: () => onPermission(record) },
          { key: 'members', icon: <TeamOutlined />, label: '添加用户', onClick: () => onMembers(record) },
          !record.is_system && {
            key: 'del',
            danger: true,
            icon: <DeleteOutlined />,
            label: '删除',
            onClick: () =>
              Modal.confirm({
                title: '确定要删除这个角色吗？',
                content: '删除后将无法恢复',
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
