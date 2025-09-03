import React, { useState, useEffect } from 'react'
import {
  Card,
  Form,
  Input,
  Button,
  message,
  Typography,
  Space,
  Divider,
  Row,
  Col,
  Switch
} from 'antd'
import {
  SettingOutlined,
  SaveOutlined,
  KeyOutlined,
  EditOutlined
} from '@ant-design/icons'
import { api } from '@shared/api/http'

const { Title, Text } = Typography
const { Password } = Input

interface SystemSettings {
  systemName: string
  defaultPassword: string
  allowUserRegistration: boolean
  maxLoginAttempts: number
}

const SettingsPage: React.FC = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState<SystemSettings>({
    systemName: '在线考试系统',
    defaultPassword: '123456',
    allowUserRegistration: true,
    maxLoginAttempts: 5
  })

  // 加载系统设置
  const loadSettings = async () => {
    try {
      setLoading(true)
      // 这里应该调用实际的API获取系统设置
      // const response = await api.get('/admin/settings')
      // setSettings(response.data)
      form.setFieldsValue(settings)
    } catch (error) {
      console.error('加载系统设置失败:', error)
      message.error('加载系统设置失败')
    } finally {
      setLoading(false)
    }
  }

  // 保存系统设置
  const handleSaveSettings = async (values: SystemSettings) => {
    try {
      setLoading(true)
      // 这里应该调用实际的API保存系统设置
      // await api.put('/admin/settings', values)
      setSettings(values)
      message.success('系统设置保存成功')
    } catch (error) {
      console.error('保存系统设置失败:', error)
      message.error('保存系统设置失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Title level={2}>
          <SettingOutlined style={{ marginRight: '8px' }} />
          系统设置
        </Title>
        <Text type="secondary">管理系统的基本配置和参数</Text>
      </div>

      <Row gutter={[24, 24]}>
        <Col span={24}>
          <Card title="基本设置" loading={loading}>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSaveSettings}
              initialValues={settings}
            >
              <Row gutter={[16, 0]}>
                <Col span={12}>
                  <Form.Item
                    label="系统名称"
                    name="systemName"
                    rules={[
                      { required: true, message: '请输入系统名称' },
                      { max: 50, message: '系统名称不能超过50个字符' }
                    ]}
                  >
                    <Input
                      prefix={<EditOutlined />}
                      placeholder="请输入系统名称"
                      maxLength={50}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="用户默认密码"
                    name="defaultPassword"
                    rules={[
                      { required: true, message: '请输入默认密码' },
                      { min: 6, message: '密码至少6位' },
                      { max: 20, message: '密码不能超过20位' }
                    ]}
                  >
                    <Password
                      prefix={<KeyOutlined />}
                      placeholder="请输入用户默认密码"
                      maxLength={20}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Divider />

              <Row gutter={[16, 0]}>
                <Col span={12}>
                  <Form.Item
                    label="允许用户注册"
                    name="allowUserRegistration"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="最大登录尝试次数"
                    name="maxLoginAttempts"
                    rules={[
                      { required: true, message: '请输入最大登录尝试次数' },
                      { type: 'number', min: 1, max: 10, message: '次数必须在1-10之间' }
                    ]}
                  >
                    <Input
                      type="number"
                      placeholder="请输入最大登录尝试次数"
                      min={1}
                      max={10}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    icon={<SaveOutlined />}
                  >
                    保存设置
                  </Button>
                  <Button
                    onClick={() => {
                      form.resetFields()
                      form.setFieldsValue(settings)
                    }}
                  >
                    重置
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default SettingsPage