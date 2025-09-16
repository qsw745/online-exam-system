// apps/web/src/features/admin-settings/components/SettingsForm.tsx
import { EditOutlined, KeyOutlined, SaveOutlined } from '@ant-design/icons'
import { Button, Form, Input, InputNumber, Space, Switch, Divider, Typography } from 'antd'
import React, { useEffect } from 'react'
import type { SystemSettings } from '@/shared/types/admin-settings'

const { Text } = Typography

type Props = {
  value?: SystemSettings | null
  loading?: boolean
  onChange?: (v: SystemSettings) => void
  onSubmit?: (v: SystemSettings) => Promise<void> | void
  onReset?: () => void
  disableSave?: boolean
}

export const SettingsForm: React.FC<Props> = ({ value, loading, onChange, onSubmit, onReset, disableSave }) => {
  const [form] = Form.useForm<SystemSettings>()

  useEffect(() => {
    if (value) form.setFieldsValue(value)
  }, [value, form])

  const handleValuesChange = (_: any, all: SystemSettings) => onChange?.(all)

  const enableStrong = Form.useWatch('enableStrongPassword', form)
  const enableCaptcha = Form.useWatch('enableCaptcha', form)

  return (
    <Form form={form} layout="vertical" onFinish={onSubmit} onValuesChange={handleValuesChange} disabled={loading}>
      <Form.Item
        label="系统名称"
        name="systemName"
        rules={[
          { required: true, message: '请输入系统名称' },
          { max: 50, message: '最多50个字符' },
        ]}
      >
        <Input prefix={<EditOutlined />} placeholder="请输入系统名称" maxLength={50} />
      </Form.Item>

      {/* 默认密码：仅写不读 */}
      <Form.Item
        label="用户默认密码（留空表示不修改）"
        name="defaultPassword"
        rules={[
          { min: 6, message: '至少6位' },
          { max: 20, message: '不能超过20位' },
        ]}
      >
        <Input.Password prefix={<KeyOutlined />} placeholder="输入以修改默认密码" maxLength={20} />
      </Form.Item>

      <Form.Item label="允许用户注册" name="allowUserRegistration" valuePropName="checked">
        <Switch />
      </Form.Item>

      <Form.Item
        label="最大登录尝试次数"
        name="maxLoginAttempts"
        rules={[{ required: true, message: '请输入最大登录尝试次数' }]}
      >
        <InputNumber min={1} max={20} style={{ width: '100%' }} />
      </Form.Item>

      <Divider />

      {/* ✅ 验证码 */}
      <Form.Item label="启用验证码" name="enableCaptcha" valuePropName="checked">
        <Switch />
      </Form.Item>
      <Form.Item
        label="当用户连续输错密码达到 N 次时出现验证码"
        name="captchaAfterFailedAttempts"
        tooltip="建议 3~5 次"
        rules={[
          { required: true, message: '请输入阈值' },
          { type: 'number', min: 1, max: 20, message: '范围 1~20' },
        ]}
      >
        <InputNumber min={1} max={20} style={{ width: '100%' }} disabled={!enableCaptcha} />
      </Form.Item>

      <Divider />

      {/* ✅ 强密码 */}
      <Form.Item label="启用强密码" name="enableStrongPassword" valuePropName="checked">
        <Switch />
      </Form.Item>

      <Text type="secondary">启用后，用户注册/重置/修改密码将按以下规则校验</Text>

      <Form.Item label="最小长度" name={['strongPasswordRules', 'minLength']} required>
        <InputNumber min={6} max={64} style={{ width: '100%' }} disabled={!enableStrong} />
      </Form.Item>

      <Form.Item label="必须包含大写字母" name={['strongPasswordRules', 'requireUpper']} valuePropName="checked">
        <Switch disabled={!enableStrong} />
      </Form.Item>
      <Form.Item label="必须包含小写字母" name={['strongPasswordRules', 'requireLower']} valuePropName="checked">
        <Switch disabled={!enableStrong} />
      </Form.Item>
      <Form.Item label="必须包含数字" name={['strongPasswordRules', 'requireNumber']} valuePropName="checked">
        <Switch disabled={!enableStrong} />
      </Form.Item>
      <Form.Item label="必须包含符号" name={['strongPasswordRules', 'requireSymbol']} valuePropName="checked">
        <Switch disabled={!enableStrong} />
      </Form.Item>

      <Form.Item
        label="禁止重复字符（如aaaa）"
        name={['strongPasswordRules', 'forbidRepeated']}
        valuePropName="checked"
      >
        <Switch disabled={!enableStrong} />
      </Form.Item>
      <Form.Item label="禁止常见弱口令" name={['strongPasswordRules', 'forbidCommon']} valuePropName="checked">
        <Switch disabled={!enableStrong} />
      </Form.Item>

      <Divider />

      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />} disabled={disableSave}>
            保存设置
          </Button>
          <Button onClick={onReset} disabled={loading}>
            重置
          </Button>
        </Space>
      </Form.Item>
    </Form>
  )
}
