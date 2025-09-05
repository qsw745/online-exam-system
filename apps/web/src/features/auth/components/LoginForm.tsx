import React from 'react'
import { Button, Input, Checkbox, Space, Typography } from 'antd'
import { UserOutlined, LockOutlined, EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons'
import { Link } from 'react-router-dom'

const { Text } = Typography

type Props = {
  email: string
  password: string
  rememberMe: boolean
  loading: boolean
  onEmailChange: (v: string) => void
  onPasswordChange: (v: string) => void
  onRememberChange: (v: boolean) => void
  onSubmit: () => void
}

export const LoginForm: React.FC<Props> = ({
  email,
  password,
  rememberMe,
  loading,
  onEmailChange,
  onPasswordChange,
  onRememberChange,
  onSubmit,
}) => {
  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        onSubmit()
      }}
      noValidate
    >
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        {/* 邮箱 */}
        <div>
          <Text style={{ display: 'block', marginBottom: 8 }}>邮箱地址</Text>
          <Input
            prefix={<UserOutlined />}
            type="email"
            value={email}
            onChange={e => onEmailChange(e.target.value)}
            placeholder="请输入您的邮箱"
            size="large"
            required
            autoComplete="email"
          />
        </div>

        {/* 密码 */}
        <div>
          <Text style={{ display: 'block', marginBottom: 8 }}>密码</Text>
          <Input.Password
            prefix={<LockOutlined />}
            value={password}
            onChange={e => onPasswordChange(e.target.value)}
            placeholder="请输入您的密码"
            size="large"
            iconRender={visible => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
            required
            autoComplete="current-password"
          />
        </div>

        {/* 记住我 & 忘记密码 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Checkbox checked={rememberMe} onChange={e => onRememberChange(e.target.checked)}>
            记住我
          </Checkbox>

          <Link to="/forgot-password">忘记密码？</Link>
        </div>

        {/* 提交 */}
        <Button type="primary" htmlType="submit" loading={loading} size="large" block>
          登录
        </Button>
      </Space>
    </form>
  )
}
