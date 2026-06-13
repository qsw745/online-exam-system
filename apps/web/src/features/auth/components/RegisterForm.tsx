import React from 'react'
import { Button, Checkbox, Form, Input, Space, Typography } from 'antd'
import { UserOutlined, LockOutlined, EyeInvisibleOutlined, EyeTwoTone, MailOutlined } from '@ant-design/icons'
import { PasswordStrengthBar } from './PasswordStrengthBar'
import type { RegisterValues } from '../../auth/hooks/useRegister'

const { Text } = Typography

type Props = {
  loading: boolean
  onSubmit: (values: RegisterValues) => void
  // 可选：注入 i18n 文案
  t?: (key: string) => string
}

export const RegisterForm: React.FC<Props> = ({ loading, onSubmit, t }) => {
  const [form] = Form.useForm<RegisterValues>()

  return (
    <Form<RegisterValues>
      form={form}
      layout="vertical"
      initialValues={{ email: '', password: '', confirmPassword: '', nickname: '', agree: false }}
      onFinish={onSubmit}
      requiredMark={false}
    >
      {/* 邮箱 */}
      <Form.Item
        name="email"
        label="邮箱地址 *"
        rules={[
          { required: true, message: '请输入邮箱地址' },
          { type: 'email', message: '请输入有效的邮箱地址' },
        ]}
      >
        <Input prefix={<MailOutlined />} type="email" placeholder="请输入您的邮箱" size="large" autoComplete="email" />
      </Form.Item>

      {/* 昵称（可选） */}
      <Form.Item name="nickname" label="昵称">
        <Input prefix={<UserOutlined />} placeholder="请输入您的昵称（可选）" size="large" maxLength={30} />
      </Form.Item>

      {/* 密码 */}
      <Form.Item
        name="password"
        label="密码 *"
        rules={[
          { required: true, message: '请输入密码' },
          { min: 6, message: '密码长度不能少于6位' },
        ]}
      >
        <Input.Password
          prefix={<LockOutlined />}
          placeholder={t?.('auth.password_placeholder') ?? '请输入密码'}
          size="large"
          iconRender={v => (v ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
          autoComplete="new-password"
          onChange={() => {
            // 触发重新渲染强度条
            const v = form.getFieldValue('password') || ''
            form.setFieldsValue({ password: v })
          }}
        />
      </Form.Item>

      {/* 密码强度条 */}
      <PasswordStrengthBar password={Form.useWatch('password', form) || ''} />

      {/* 确认密码 */}
      <Form.Item
        name="confirmPassword"
        label={t?.('auth.confirm_password') ?? '确认密码 *'}
        dependencies={['password']}
        rules={[
          { required: true, message: '请再次输入密码' },
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
          placeholder={t?.('auth.confirm_password_placeholder') ?? '请再次输入密码'}
          size="large"
          iconRender={v => (v ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
          autoComplete="new-password"
        />
      </Form.Item>

      {/* 用户协议 */}
      <Form.Item
        name="agree"
        valuePropName="checked"
        rules={[
          {
            validator: (_, v) => (v ? Promise.resolve() : Promise.reject(new Error('请阅读并同意相关条款'))),
          },
        ]}
      >
        <Checkbox>
          <Text style={{ fontSize: 14 }}>
            {t?.('auth.agree_terms') ?? '我已阅读并同意'}
            <a href="#" style={{ color: '#1890ff', margin: '0 4px' }}>
              {t?.('auth.terms') ?? '用户协议'}
            </a>
            和
            <a href="#" style={{ color: '#1890ff', margin: '0 4px' }}>
              {t?.('auth.privacy') ?? '隐私政策'}
            </a>
            。
          </Text>
        </Checkbox>
      </Form.Item>

      {/* 提交 */}
      <Form.Item style={{ marginBottom: 0 }}>
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <Button type="primary" htmlType="submit" loading={loading} size="large" block>
            创建账户
          </Button>
        </Space>
      </Form.Item>
    </Form>
  )
}
