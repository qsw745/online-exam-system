import React from 'react'
import { Button, Input, Checkbox, Space, Typography, Row, Col, Tooltip } from 'antd'
import {
  UserOutlined,
  LockOutlined,
  EyeInvisibleOutlined,
  EyeTwoTone,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { Link } from 'react-router-dom'

const { Text } = Typography

type Props = {
  email: string
  password: string
  rememberMe: boolean
  keep7Days: boolean
  loading: boolean

  // 验证码
  captchaRequired: boolean
  captcha: string
  captchaImgUrl?: string
  onCaptchaChange: (v: string) => void
  onRefreshCaptcha: () => void

  onEmailChange: (v: string) => void
  onPasswordChange: (v: string) => void
  onRememberChange: (v: boolean) => void
  onKeep7DaysChange: (v: boolean) => void
  onSubmit: () => void
}

export const LoginForm: React.FC<Props> = ({
  email,
  password,
  rememberMe,
  keep7Days,
  loading,
  captchaRequired,
  captcha,
  captchaImgUrl,
  onCaptchaChange,
  onRefreshCaptcha,
  onEmailChange,
  onPasswordChange,
  onRememberChange,
  onKeep7DaysChange,
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
            autoComplete="username"
          />
        </div>

        {/* 密码 */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ display: 'block', marginBottom: 8 }}>密码</Text>
            <Tooltip title="强密码请包含大小写字母/数字/符号，长度符合系统设置">
              <SafetyCertificateOutlined style={{ opacity: 0.6 }} />
            </Tooltip>
          </div>
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

        {/* 验证码（按需显示） */}
        {captchaRequired && (
          <div>
            <Text style={{ display: 'block', marginBottom: 8 }}>验证码</Text>
            <Row gutter={8} align="middle">
              <Col flex="auto">
                <Input
                  value={captcha}
                  onChange={e => onCaptchaChange(e.target.value)}
                  placeholder="请输入图片中的字符"
                  size="large"
                  autoComplete="off"
                />
              </Col>
              <Col>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {/* 这里显示的是后端 /captcha/new 返回的 svg 转 dataURL */}
                  <img
                    src={captchaImgUrl}
                    alt="captcha"
                    style={{ height: 40, borderRadius: 6, border: '1px solid #eee' }}
                  />
                  <Button icon={<ReloadOutlined />} onClick={onRefreshCaptcha} />
                </div>
              </Col>
            </Row>
          </div>
        )}

        {/* 记住我 & 7 天免登录 & 忘记密码 */}
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
        >
          <Checkbox checked={rememberMe} onChange={e => onRememberChange(e.target.checked)}>
            记住我（下次自动填充）
          </Checkbox>

          <Checkbox checked={keep7Days} onChange={e => onKeep7DaysChange(e.target.checked)}>
            7 天免登录
          </Checkbox>

          <Link to="/forgot-password" style={{ marginLeft: 'auto' }}>
            忘记密码？
          </Link>
        </div>

        {/* 提交 */}
        <Button type="primary" htmlType="submit" loading={loading} size="large" block>
          登录
        </Button>
      </Space>
    </form>
  )
}
