import { Button, List, Modal, Popconfirm, Space, Tag, Typography } from 'antd'
import React from 'react'

export type Role = { id: number; name: string }
export type User = { id: number; username: string; email?: string; status?: string }

export default function RoleMembersModal({
  open,
  role,
  loading,
  members,
  onClose,
  onRemove,
  onOpenUserSelect,
  onOpenOrgSelect,
  onRefresh,
}: {
  open: boolean
  role: Role | null
  loading: boolean
  members: User[]
  onClose: () => void
  onRemove: (userId: number) => void | Promise<void>
  onOpenUserSelect: () => void | Promise<void>
  onOpenOrgSelect: () => void | Promise<void>
  onRefresh: () => Promise<void> | null
}) {
  return (
    <Modal
      title={role ? `角色成员 - ${role.name}` : '角色成员'}
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
      destroyOnHidden
    >
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={onOpenUserSelect}>
          添加用户
        </Button>
        <Button onClick={onOpenOrgSelect}>按机构添加</Button>
        <Button onClick={onRefresh || undefined}>刷新</Button>
      </Space>

      <List
        loading={loading}
        dataSource={members}
        rowKey="id"
        renderItem={u => (
          <List.Item
            actions={[
              <Popconfirm key="rm" title="确定移除该用户？" onConfirm={() => onRemove(u.id)}>
                <Button type="link" danger>
                  移除
                </Button>
              </Popconfirm>,
            ]}
          >
            <List.Item.Meta
              title={
                <Space>
                  <Typography.Text>{u.username}</Typography.Text>
                  {(u.status ?? 'active') !== 'active' && <Tag color="red">禁用</Tag>}
                </Space>
              }
              description={u.email}
            />
          </List.Item>
        )}
      />
    </Modal>
  )
}
