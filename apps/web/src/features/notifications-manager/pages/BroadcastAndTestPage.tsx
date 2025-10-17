import { Button, Card, Form, Input, Radio, Space } from 'antd'
import React from 'react'

export default function BroadcastAndTestPage() {
  const [form] = Form.useForm()

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Card title="消息群发">
        <Form form={form} layout="vertical" onFinish={() => {}}>
          <Form.Item name="channel" label="渠道" initialValue="site">
            <Radio.Group>
              <Radio.Button value="site">站内信</Radio.Button>
              <Radio.Button value="email">邮件</Radio.Button>
              <Radio.Button value="sms">短信</Radio.Button>
              <Radio.Button value="webhook">Webhook</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="audience" label="受众" rules={[{ required: true }]}>
            <Input placeholder="按组织/角色/用户筛选（后续接选择器）" />
          </Form.Item>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true }]}>
            <Input.TextArea rows={6} />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            发送
          </Button>
        </Form>
      </Card>

      <Card title="单人测试发送">
        <Form layout="inline" onFinish={() => {}}>
          <Form.Item name="user" rules={[{ required: true, message: '请输入用户ID/邮箱/手机号' }]}>
            <Input placeholder="用户ID / 邮箱 / 手机号" style={{ width: 280 }} />
          </Form.Item>
          <Form.Item name="title" rules={[{ required: true }]}>
            <Input placeholder="标题" style={{ width: 220 }} />
          </Form.Item>
          <Form.Item name="content" rules={[{ required: true }]}>
            <Input placeholder="内容" style={{ width: 320 }} />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            测试发送
          </Button>
        </Form>
      </Card>
    </Space>
  )
}
