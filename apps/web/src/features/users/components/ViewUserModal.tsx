import { Descriptions, Modal, Tag } from 'antd'
import dayjs from '@/shared/utils/dayjs'
import React from 'react'

export const ViewUserModal: React.FC<{
  open: boolean
  user: any | null
  orgPath: string | null | undefined
  onClose: () => void
}> = ({ open, user, orgPath, onClose }) => {
  const createdAt = user?.created_at || user?.createdAt || user?.createdTime || user?.meta?.createdAt || null

  return (
    <Modal
      title="用户详情"
      open={open}
      onCancel={onClose}
      onOk={onClose}
      okText="关闭"
      cancelButtonProps={{ style: { display: 'none' } }}
      // antd v5 正确写法是 destroyOnHidden
      // destroyOnHidden
    >
      <Descriptions
        column={1}
        size="small"
        // ⚠️ 新写法：用 styles 而不是 labelStyle
        styles={{ label: { width: 92 } }}
      >
        <Descriptions.Item label="用户ID">{user?.id ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="用户名">{user?.username || '-'}</Descriptions.Item>
        <Descriptions.Item label="邮箱">{user?.email || '-'}</Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={user?.status === 'active' ? 'green' : 'red'}>{user?.status === 'active' ? '正常' : '禁用'}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="角色">{user?.role || user?.roles?.join?.(', ') || '-'}</Descriptions.Item>
        <Descriptions.Item label="机构路径">{orgPath || '—'}</Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {createdAt ? dayjs(createdAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
        </Descriptions.Item>
      </Descriptions>
    </Modal>
  )
}
