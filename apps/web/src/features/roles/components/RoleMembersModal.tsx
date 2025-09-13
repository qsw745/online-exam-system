import { Button, List, Modal, Popconfirm, Space, Tag, Typography, Spin, Divider } from 'antd'
import React from 'react'

export type Role = { id: number; name: string }
export type User = { id: number; username: string; email?: string; status?: string }
export type RoleOrg = { id: number; name?: string }

export default function RoleMembersModal({
  open,
  role,
  loading,
  members,
  roleOrgs = [],
  orgsLoading = false,
  onClose,
  onRemove,
  onOpenUserSelect,
  onOpenOrgSelect,
  onRemoveOrg, // 可选：移除机构
  onRefresh,
}: {
  open: boolean
  role: Role | null
  loading: boolean
  members: User[]
  roleOrgs?: RoleOrg[]
  orgsLoading?: boolean
  onClose: () => void
  onRemove: (userId: number) => void | Promise<void>
  onOpenUserSelect: () => void | Promise<void>
  onOpenOrgSelect: () => void | Promise<void>
  onRemoveOrg?: (orgId: number) => void | Promise<void>
  onRefresh?: () => void | Promise<void>
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
        <Button onClick={onRefresh}>{'刷新'}</Button>
      </Space>

      {/* 已关联机构 */}
      <div style={{ padding: '8px 0' }}>
        <Typography.Text strong>已关联机构：</Typography.Text>
        <div style={{ marginTop: 8 }}>
          {orgsLoading ? (
            <Spin />
          ) : roleOrgs.length ? (
            <Space wrap>
              {roleOrgs.map(o => (
                <Tag
                  key={o.id}
                  color="blue"
                  closable={!!onRemoveOrg}
                  onClose={e => {
                    e.preventDefault()
                    onRemoveOrg && onRemoveOrg(Number(o.id))
                  }}
                >
                  {o.name || `#${o.id}`}
                </Tag>
              ))}
            </Space>
          ) : (
            <Typography.Text type="secondary">暂无关联机构</Typography.Text>
          )}
        </div>
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {/* 成员列表 */}
      <List
        header={<Typography.Text strong>成员列表</Typography.Text>}
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
