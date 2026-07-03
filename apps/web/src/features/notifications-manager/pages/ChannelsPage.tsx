import { Button, Card, Form, Input, Modal, Space, Switch, Table, Tag } from 'antd'
import React, { useMemo, useState } from 'react'
import { translate } from '@/shared/utils/i18n'

type Channel = { id: number; code: string; name: string; enabled: boolean; remark?: string }

export default function ChannelsPage() {
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const data = useMemo<Channel[]>(
    () => [
      { id: 1, code: 'site', name: translate('auto.ab2bf56c23'), enabled: true },
      { id: 2, code: 'email', name: translate('menus.system-mail'), enabled: true },
      { id: 3, code: 'sms', name: translate('auto.17e1a481d8'), enabled: false, remark: '需配置供应商' },
      { id: 4, code: 'webhook', name: 'Webhook', enabled: false },
    ],
    []
  )

  return (
    <Card title={translate('auto.407274225e')} extra={<Button onClick={() => setOpen(true)}>{translate('auto.d4733cdf9d')}</Button>}>
      <Table
        rowKey="id"
        dataSource={data}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 80 },
          { title: translate('dict.col_code'), dataIndex: 'code', width: 140, render: v => <Tag>{v}</Tag> },
          { title: translate('systemConfig.col_name'), dataIndex: 'name' },
          { title: translate('users.status.enable'), dataIndex: 'enabled', width: 120, render: (v: boolean) => <Switch checked={v} /> },
          { title: translate('users.form.remark'), dataIndex: 'remark' },
          {
            title: translate('users.columns.actions'),
            width: 160,
            render: () => (
              <Space>
                <Button size="small" onClick={() => setOpen(true)}>
                  {translate('app.edit')}</Button>
                <Button size="small" danger>
                  {translate('app.delete')}</Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal title={translate('auto.0601b4ea1b')} open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={() => setOpen(false)}>
          <Form.Item name="code" label={translate('auto.8223333057')} rules={[{ required: true }]}>
            <Input placeholder="site / email / sms / webhook" />
          </Form.Item>
          <Form.Item name="name" label={translate('auto.99e9ec8d48')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="config" label={translate('auto.f3fef46544')}>
            <Input.TextArea rows={6} placeholder={translate('auto.de23326b7f')} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
