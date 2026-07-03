import { Descriptions, Modal, Tag } from 'antd'
import dayjs from '@/shared/utils/dayjs'
import React from 'react'
import { translate } from '@/shared/utils/i18n'
import { formatDateTime } from '@/shared/utils/datetime'

export const ViewUserModal: React.FC<{
  open: boolean
  user: any | null
  orgPath: string | null | undefined
  onClose: () => void
}> = ({ open, user, orgPath, onClose }) => {
  const createdAt = user?.created_at || user?.createdAt || user?.createdTime || user?.meta?.createdAt || null

  return (
    <Modal
      title={translate('auto.4e1056fe95')}
      open={open}
      onCancel={onClose}
      onOk={onClose}
      okText={translate('app.close')}
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
        <Descriptions.Item label={translate('aiLogs.user_id')}>{user?.id ?? '-'}</Descriptions.Item>
        <Descriptions.Item label={translate('auth.username')}>{user?.username || '-'}</Descriptions.Item>
        <Descriptions.Item label={translate('auth.email')}>{user?.email || '-'}</Descriptions.Item>
        <Descriptions.Item label={translate('users.columns.status')}>
          <Tag color={user?.status === 'active' ? 'green' : 'red'}>{user?.status === 'active' ? translate('examPage.proctor.status.ok') : translate('users.status.disable')}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label={translate('auth.role')}>{user?.role || user?.roles?.join?.(', ') || '-'}</Descriptions.Item>
        <Descriptions.Item label={translate('auto.f4d801cba3')}>{orgPath || '—'}</Descriptions.Item>
        <Descriptions.Item label={translate('users.columns.created_at')}>
          {createdAt ? formatDateTime(createdAt) : '-'}
        </Descriptions.Item>
      </Descriptions>
    </Modal>
  )
}
