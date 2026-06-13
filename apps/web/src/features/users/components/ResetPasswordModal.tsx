// src/features/users/components/ResetPasswordModal.tsx
import React from 'react'
import { Modal, Form, Input, Typography, Space } from 'antd'
import { useLanguage } from '@/shared/contexts/LanguageContext'

const { Text } = Typography

function scorePassword(pwd: string): number {
  let score = 0
  if (pwd.length >= 8) score++
  if (/[A-Z]/.test(pwd)) score++
  if (/[a-z]/.test(pwd)) score++
  if (/\d/.test(pwd)) score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++
  return Math.min(5, score)
}

export const ResetPasswordModal: React.FC<{
  open: boolean
  username?: string
  onCancel: () => void
  onSubmit: (password: string) => Promise<void> | void
}> = ({ open, username, onCancel, onSubmit }) => {
  const [form] = Form.useForm()
  const { t } = useLanguage()
  const pwd = Form.useWatch('password', form) || ''
  const s = scorePassword(pwd)
  const bars = Array.from({ length: 5 })
  const strengthLabels = React.useMemo(
    () => [
      t('users.reset_password.strength.1'),
      t('users.reset_password.strength.2'),
      t('users.reset_password.strength.3'),
      t('users.reset_password.strength.4'),
      t('users.reset_password.strength.5'),
    ],
    [t]
  )

  return (
    <Modal
      open={open}
      title={t('users.reset_password.title').replace('{name}', username ?? '')}
      onCancel={() => {
        form.resetFields()
        onCancel()
      }}
      onOk={() => form.submit()}
      okText={t('app.confirm')}
      destroyOnHidden
      maskClosable={false}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={async vals => {
          await onSubmit(vals.password)
          form.resetFields()
        }}
      >
        <Form.Item
          label={t('users.reset_password.label')}
          name="password"
          rules={[
            { required: true, message: t('users.reset_password.required') },
            { min: 8, message: t('users.reset_password.min').replace('{count}', '8') },
            {
              validator: (_, v) => {
                if (!v) return Promise.resolve()
                const kinds = [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z0-9]/].reduce((n, r) => n + (r.test(v) ? 1 : 0), 0)
                return kinds >= 2
                  ? Promise.resolve()
                  : Promise.reject(new Error(t('users.reset_password.rule')))
              },
            },
          ]}
        >
          <Input.Password placeholder={t('users.reset_password.placeholder')} allowClear />
        </Form.Item>

        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {bars.map((_, i) => (
              <div
                key={i}
                style={{
                  height: 8,
                  borderRadius: 6,
                  background: i < s ? '#1677ff' : '#ebedf0',
                  transition: 'all .2s',
                }}
              />
            ))}
          </div>
          <Text type="secondary">{strengthLabels[Math.max(0, s - 1)] || strengthLabels[0]}</Text>
        </Space>
      </Form>
    </Modal>
  )
}

export default ResetPasswordModal
