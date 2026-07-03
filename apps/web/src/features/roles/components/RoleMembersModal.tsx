import { Button, List, Modal, Popconfirm, Space, Tag, Typography, Spin, Divider, message } from 'antd'
import React from 'react'
import { translate } from '@/shared/utils/i18n'

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
  onRemoveOrg,
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
  onOpenOrgSelect?: () => void | Promise<void>
  onRemoveOrg?: (orgId: number) => void | Promise<void>
  onRefresh?: () => void | Promise<void>
}) {
  const handleOpenOrgSelect = async () => {
    try {
      if (onOpenOrgSelect) await onOpenOrgSelect()
      else {
        Modal.info({
          title: translate('auto.a9f4eaad27'),
          content: translate('auto.113277b02f'),
        })
      }
    } catch (err: any) {
      message.error(err?.message || translate('auto.7d8050dbe0'))
    }
  }

  return (
    <Modal
      title={role ? `角色成员 - ${role.name}` : translate('visible.cc91bf7426')}
      open={open}
      maskClosable={false}
      onCancel={onClose}
      footer={null}
      width={720}
      destroyOnHidden
    >
      <Space style={{ marginBottom: 12 }} wrap>
        <Button type="primary" onClick={onOpenUserSelect}>
          {translate('auto.4f965d4969')}</Button>
        <Button onClick={handleOpenOrgSelect}>{translate('auto.83e5165f14')}</Button>
        <Button onClick={onRefresh}>{translate('app.refresh')}</Button>
      </Space>

      {/* 已关联机构 */}
      <div style={{ padding: '8px 0' }}>
        <Typography.Text strong>{translate('auto.1b1d4ecc1a')}</Typography.Text>
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
            <Typography.Text type="secondary">{translate('auto.f8916c374c')}</Typography.Text>
          )}
        </div>
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {/* 成员列表 */}
      <List
        header={<Typography.Text strong>{translate('auto.5eb3dcf3b9')}</Typography.Text>}
        loading={loading}
        dataSource={members}
        rowKey="id"
        renderItem={u => (
          <List.Item
            actions={[
              <Popconfirm key="rm" title={translate('auto.989c3955eb')} onConfirm={() => onRemove(u.id)}>
                <Button type="link" danger>
                  {translate('papers.op_remove')}</Button>
              </Popconfirm>,
            ]}
          >
            <List.Item.Meta
              title={
                <Space>
                  <Typography.Text>{u.username}</Typography.Text>
                  {(u.status ?? 'active') !== 'active' && <Tag color="red">{translate('users.status.disable')}</Tag>}
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
