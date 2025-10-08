// src/features/users/components/ResetPasswordModal.tsx
import React from 'react'
import { Modal, Form, Input, Typography, Space } from 'antd'

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

const labels = ['非常弱', '弱', '一般', '强', '非常强']

export const ResetPasswordModal: React.FC<{
  open: boolean
  username?: string
  onCancel: () => void
  onSubmit: (password: string) => Promise<void> | void
}> = ({ open, username, onCancel, onSubmit }) => {
  const [form] = Form.useForm()
  const pwd = Form.useWatch('password', form) || ''
  const s = scorePassword(pwd)
  const bars = Array.from({ length: 5 })

  return (
    <Modal
      open={open}
      title={`重置 ${username ?? ''} 用户的密码`}
      onCancel={() => {
        form.resetFields()
        onCancel()
      }}
      onOk={() => form.submit()}
      okText="确定"
      destroyOnClose
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
          label="请输入新密码"
          name="password"
          rules={[
            { required: true, message: '请输入新密码' },
            { min: 8, message: '至少 8 位' },
            {
              validator: (_, v) => {
                if (!v) return Promise.resolve()
                const kinds = [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z0-9]/].reduce((n, r) => n + (r.test(v) ? 1 : 0), 0)
                return kinds >= 2 ? Promise.resolve() : Promise.reject(new Error('至少包含两类字符(大小写/数字/符号)'))
              },
            },
          ]}
        >
          <Input.Password placeholder="请输入新密码" allowClear />
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
          <Text type="secondary">{labels[Math.max(0, s - 1)] || '非常弱'}</Text>
        </Space>
      </Form>
    </Modal>
  )
}

export default ResetPasswordModal
