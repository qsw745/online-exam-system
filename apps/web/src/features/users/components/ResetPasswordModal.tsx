// src/features/users/components/ResetPasswordModal.tsx
import { Modal, Typography } from 'antd'
import React from 'react'
const { Text, Paragraph } = Typography

export const ResetPasswordModal: React.FC<{
  open: boolean
  password: string | null
  onClose: () => void
}> = ({ open, password, onClose }) => {
  return (
    <Modal open={open} title="密码已重置" onCancel={onClose} onOk={onClose} okText="我已记住" destroyOnHidden>
      <Paragraph>请妥善保存以下临时/新密码：</Paragraph>
      <Paragraph copyable={{ text: password || '' }}>
        <Text code style={{ fontSize: 16 }}>
          {password || '（后端未返回密码）'}
        </Text>
      </Paragraph>
      <Text type="secondary">提示：首次登录后建议尽快修改为自定义密码。</Text>
    </Modal>
  )
}
