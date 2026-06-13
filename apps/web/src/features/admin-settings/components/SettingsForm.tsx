// apps/web/src/features/admin-settings/components/SettingsForm.tsx
import { CloudOutlined, EditOutlined, KeyOutlined, SaveOutlined } from '@ant-design/icons'
import { Button, Form, Input, InputNumber, Space, Switch, Divider, Typography, Select, Alert } from 'antd'
import React, { useEffect } from 'react'
import type { SystemSettings } from '@/shared/types/admin-settings'

const { Text } = Typography

const PROVIDER_OPTIONS = [
  { label: 'DeepSeek', value: 'deepseek' },
  { label: 'OpenAI', value: 'openai' },
  { label: '自定义 OpenAI 兼容接口', value: 'custom' },
  { label: '本地模型', value: 'local' },
]

const THINKING_OPTIONS = [
  { label: '关闭', value: 'disabled' },
  { label: '开启', value: 'enabled' },
]

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
  const aiEnabled = Form.useWatch('aiEnabled', form)
  const aiProvider = Form.useWatch('aiProvider', form)
  const aiApiKeySet = Form.useWatch('aiApiKeySet', form)

  return (
    <Form form={form} layout="vertical" onFinish={onSubmit} onValuesChange={handleValuesChange} disabled={loading}>
      <Form.Item name="aiApiKeySet" valuePropName="checked" hidden>
        <Switch />
      </Form.Item>

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

      <Typography.Title level={5} style={{ marginTop: 0 }}>
        <CloudOutlined style={{ marginRight: 8 }} />
        大模型设置
      </Typography.Title>

      <Form.Item label="启用 AI 功能" name="aiEnabled" valuePropName="checked">
        <Switch />
      </Form.Item>

      <Form.Item label="大模型厂商" name="aiProvider" rules={[{ required: true, message: '请选择大模型厂商' }]}>
        <Select options={PROVIDER_OPTIONS} disabled={!aiEnabled} />
      </Form.Item>

      <Form.Item
        label="接口地址 Base URL"
        name="aiBaseUrl"
        rules={[
          { required: !!aiEnabled && aiProvider !== 'local', message: '请输入接口地址' },
          { max: 300, message: '最多300个字符' },
        ]}
      >
        <Input placeholder="https://api.deepseek.com" disabled={!aiEnabled} />
      </Form.Item>

      <Form.Item
        label="API Key"
        name="aiApiKey"
        tooltip="留空表示不修改已保存的密钥"
        rules={[{ max: 300, message: '最多300个字符' }]}
      >
        <Input.Password
          prefix={<KeyOutlined />}
          placeholder={aiApiKeySet ? '已设置，留空不修改' : '请输入 API Key'}
          disabled={!aiEnabled || aiProvider === 'local'}
        />
      </Form.Item>

      {aiApiKeySet && aiProvider !== 'local' && (
        <Alert type="success" showIcon message="API Key 已设置，保存时留空会继续沿用原密钥" style={{ marginBottom: 16 }} />
      )}

      <Form.Item label="默认模型" name="aiModel" rules={[{ required: true, message: '请输入模型名称' }]}>
        <Input placeholder="deepseek-v4-flash" disabled={!aiEnabled} />
      </Form.Item>

      <Form.Item
        label="允许使用的模型"
        name="aiAllowedModels"
        tooltip="多个模型用英文逗号分隔；留空表示不限制前端传入的模型名"
      >
        <Input placeholder="deepseek-v4-flash,deepseek-v4-pro" disabled={!aiEnabled} />
      </Form.Item>

      {aiProvider === 'deepseek' && (
        <Form.Item label="DeepSeek 推理模式" name="aiThinkingMode">
          <Select options={THINKING_OPTIONS} disabled={!aiEnabled} />
        </Form.Item>
      )}

      <Form.Item
        label="温度"
        name="aiTemperature"
        rules={[{ type: 'number', min: 0, max: 2, message: '范围 0~2' }]}
      >
        <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} disabled={!aiEnabled} />
      </Form.Item>

      <Form.Item
        label="最大输出 Token"
        name="aiMaxTokens"
        rules={[{ type: 'number', min: 1, max: 100000, message: '范围 1~100000' }]}
      >
        <InputNumber min={1} max={100000} style={{ width: '100%' }} disabled={!aiEnabled} />
      </Form.Item>

      <Form.Item
        label="请求超时（毫秒）"
        name="aiTimeoutMs"
        rules={[{ type: 'number', min: 1000, max: 300000, message: '范围 1000~300000' }]}
      >
        <InputNumber min={1000} max={300000} step={1000} style={{ width: '100%' }} disabled={!aiEnabled} />
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
