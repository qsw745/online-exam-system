import React from 'react'
import { Form, Input, Button } from 'antd'
import { LockOutlined, EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons'
import type { ResetValues } from '../../auth/hooks/useResetPassword'
import { PasswordStrengthBar } from '../../auth/components/PasswordStrengthBar' // 可选：如果已存在

type Props = {
  loading: boolean
  onSubmit: (values: ResetValues) => void
}

export const ResetPasswordForm: React.FC<Props> = ({ loading, onSubmit }) => {
  const [form] = Form.useForm<ResetValues>()
  const pwd = Form.useWatch('password', form)

  return (
    <Form<ResetValues> form={form} layout="vertical" onFinish={onSubmit} size="large">
      <Form.Item
        name="password"
        label="新密码"
        rules={[
          { required: true, message: '请输入新密码' },
          { min: 6, message: '密码长度至少6位' },
          { pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/, message: '密码必须包含字母和数字' },
        ]}
      >
        <Input.Password
          prefix={<LockOutlined />}
          placeholder="请输入新密码（至少6位，包含字母和数字）"
          iconRender={v => (v ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
        />
      </Form.Item>

      {/* 可选：密码强度条 */}
      <PasswordStrengthBar password={pwd || ''} />

      <Form.Item
        name="confirmPassword"
        label="确认密码"
        dependencies={['password']}
        rules={[
          { required: true, message: '请确认新密码' },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('password') === value) return Promise.resolve()
              return Promise.reject(new Error('两次输入的密码不一致'))
            },
          }),
        ]}
      >
        <Input.Password
          prefix={<LockOutlined />}
          placeholder="请再次输入新密码"
          iconRender={v => (v ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
        />
      </Form.Item>

      <Form.Item style={{ marginBottom: 16 }}>
        <Button type="primary" htmlType="submit" loading={loading} block size="large" style={{ height: 48 }}>
          {loading ? '重置中…' : '重置密码'}
        </Button>
      </Form.Item>
    </Form>
  )
}
