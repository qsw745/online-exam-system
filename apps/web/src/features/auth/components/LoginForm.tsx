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

  submitDisabled: boolean
  inputsDisabled: boolean
  isLocked: boolean
  lockCountdownText: string
  lockTryRemainSec: number
  lockRetryCountdownText: string

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

export const LoginForm: React.FC<Props> = p => {
  const lockedNow = p.isLocked && p.lockCountdownText !== '00:00'
  const btnText = !lockedNow
    ? '登录'
    : p.lockTryRemainSec > 0
    ? `已锁定 ${p.lockCountdownText} · 重试 ${p.lockRetryCountdownText}`
    : `重试登录（剩余 ${p.lockCountdownText}）`

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        if (!p.submitDisabled) p.onSubmit()
      }}
      noValidate
    >
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        <div>
          <Text style={{ display: 'block', marginBottom: 8 }}>邮箱地址</Text>
          <Input
            prefix={<UserOutlined />}
            type="email"
            value={p.email}
            onChange={e => p.onEmailChange(e.target.value)}
            placeholder="请输入您的邮箱"
            size="large"
            required
            autoComplete="username"
            disabled={p.inputsDisabled}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ display: 'block', marginBottom: 8 }}>密码</Text>
            <Tooltip title="强密码请包含大小写字母/数字/符号">
              <SafetyCertificateOutlined style={{ opacity: 0.6 }} />
            </Tooltip>
          </div>
          <Input.Password
            prefix={<LockOutlined />}
            value={p.password}
            onChange={e => p.onPasswordChange(e.target.value)}
            placeholder="请输入您的密码"
            size="large"
            iconRender={v => (v ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
            required
            autoComplete="current-password"
            disabled={p.inputsDisabled}
          />
        </div>

        {p.captchaRequired && (
          <div>
            <Text style={{ display: 'block', marginBottom: 8 }}>验证码</Text>
            <Row gutter={8} align="middle">
              <Col flex="auto">
                <Input
                  value={p.captcha}
                  onChange={e => p.onCaptchaChange(e.target.value)}
                  placeholder="请输入图片中的字符"
                  size="large"
                  autoComplete="off"
                  disabled={p.inputsDisabled}
                />
              </Col>
              <Col>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <img
                    src={p.captchaImgUrl}
                    alt="captcha"
                    style={{
                      height: 40,
                      borderRadius: 6,
                      border: '1px solid #eee',
                      opacity: p.inputsDisabled ? 0.6 : 1,
                    }}
                    onClick={p.inputsDisabled ? undefined : p.onRefreshCaptcha}
                  />
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={p.onRefreshCaptcha}
                    disabled={p.inputsDisabled}
                    aria-disabled={p.inputsDisabled}
                  />
                </div>
              </Col>
            </Row>
          </div>
        )}

        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
        >
          <Checkbox
            checked={p.rememberMe}
            onChange={e => p.onRememberChange(e.target.checked)}
            disabled={p.inputsDisabled}
          >
            记住我
          </Checkbox>
          <Checkbox
            checked={p.keep7Days}
            onChange={e => p.onKeep7DaysChange(e.target.checked)}
            disabled={p.inputsDisabled}
          >
            7 天免登录
          </Checkbox>
          <Link
            to="/forgot-password"
            style={{
              marginLeft: 'auto',
              pointerEvents: p.inputsDisabled ? 'none' : 'auto',
              opacity: p.inputsDisabled ? 0.6 : 1,
            }}
          >
            忘记密码？
          </Link>
        </div>

        <Button
          type="primary"
          htmlType="submit"
          loading={p.loading}
          size="large"
          block
          // ✅ 仅在10s冷却期间禁用；不影响锁定提示显示
          disabled={p.loading || (p.isLocked && p.lockTryRemainSec > 0)}
          aria-disabled={p.loading || (p.isLocked && p.lockTryRemainSec > 0)}
        >
          {btnText}
        </Button>
      </Space>
    </form>
  )
}
