import { Card, Form, Switch } from 'antd'
import React from 'react'
import { translate } from '@/shared/utils/i18n'

export default function SubscriptionPreferencesPage() {
  return (
    <Card title={translate('auto.f99dbb7114')}>
      <Form labelCol={{ span: 6 }} wrapperCol={{ span: 10 }}>
        <Form.Item label={translate('auto.ab2bf56c23')} name="site" valuePropName="checked" initialValue={true}>
          <Switch />
        </Form.Item>
        <Form.Item label={translate('menus.system-mail')} name="email" valuePropName="checked" initialValue={true}>
          <Switch />
        </Form.Item>
        <Form.Item label={translate('auto.17e1a481d8')} name="sms" valuePropName="checked" initialValue={false}>
          <Switch />
        </Form.Item>
        <Form.Item label="Webhook" name="webhook" valuePropName="checked" initialValue={false}>
          <Switch />
        </Form.Item>
      </Form>
    </Card>
  )
}
