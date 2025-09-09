// features/admin-settings/components/SettingsForm.tsx
import { EditOutlined, KeyOutlined, SaveOutlined } from '@ant-design/icons'
import { Button, Form, Input, InputNumber, Space, Switch } from 'antd'
import React, { useEffect } from 'react'
import type { SystemSettings } from '@/shared/types/admin-settings'

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

  // 同步外部值到表单
  useEffect(() => {
    if (value) form.setFieldsValue(value)
  }, [value, form])

  // 回填 onValuesChange
  const handleValuesChange = (_: any, all: SystemSettings) => onChange?.(all)

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

      {/* 默认密码：仅写不读，不预填现有密码 */}
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
        <InputNumber min={1} max={10} style={{ width: '100%' }} />
      </Form.Item>

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
