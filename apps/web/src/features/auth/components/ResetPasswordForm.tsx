import React from 'react'
import { Form, Input, Button } from 'antd'
import { LockOutlined, EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons'
import type { ResetValues } from '../hooks/useResetPassword'
import { PasswordStrengthBar } from './PasswordStrengthBar' // 可选：如果已存在
import { translate } from '@/shared/utils/i18n'

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
        label={translate('account.new_password')}
        rules={[
          { required: true, message: translate('users.reset_password.label') },
          { min: 6, message: translate('auto.3bbd0a8411') },
          { pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/, message: translate('auto.3df8bab8d1') },
        ]}
      >
        <Input.Password
          prefix={<LockOutlined />}
          placeholder={translate('auto.f4e626e7d0')}
          iconRender={v => (v ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
        />
      </Form.Item>

      {/* 可选：密码强度条 */}
      <PasswordStrengthBar password={pwd || ''} />

      <Form.Item
        name="confirmPassword"
        label={translate('auth.confirm_password')}
        dependencies={['password']}
        rules={[
          { required: true, message: translate('auto.c2d891d87f') },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('password') === value) return Promise.resolve()
              return Promise.reject(new Error(translate('auto.3e2b222d98')))
            },
          }),
        ]}
      >
        <Input.Password
          prefix={<LockOutlined />}
          placeholder={translate('account.confirm_new_password_required')}
          iconRender={v => (v ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
        />
      </Form.Item>

      <Form.Item style={{ marginBottom: 16 }}>
        <Button type="primary" htmlType="submit" loading={loading} block size="large" style={{ height: 48 }}>
          {loading ? translate('visible.2c826f08e6') : translate('users.action.reset_password')}
        </Button>
      </Form.Item>
    </Form>
  )
}
