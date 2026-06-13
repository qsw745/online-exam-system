import { Card, Form, Switch } from 'antd'
import React from 'react'

export default function SubscriptionPreferencesPage() {
  return (
    <Card title="订阅偏好">
      <Form labelCol={{ span: 6 }} wrapperCol={{ span: 10 }}>
        <Form.Item label="站内信" name="site" valuePropName="checked" initialValue={true}>
          <Switch />
        </Form.Item>
        <Form.Item label="邮件" name="email" valuePropName="checked" initialValue={true}>
          <Switch />
        </Form.Item>
        <Form.Item label="短信" name="sms" valuePropName="checked" initialValue={false}>
          <Switch />
        </Form.Item>
        <Form.Item label="Webhook" name="webhook" valuePropName="checked" initialValue={false}>
          <Switch />
        </Form.Item>
      </Form>
    </Card>
  )
}
