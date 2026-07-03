import { Button, Card, Form, Input, Modal, Space, Table, Tag } from 'antd'
import React, { useMemo, useState } from 'react'
import { translate } from '@/shared/utils/i18n'
import { formatDateTime } from '@/shared/utils/datetime'

type Template = {
  id: number
  name: string
  channel: 'site' | 'email' | 'sms' | 'webhook'
  updated_at: string
}

export default function MessageTemplatesPage() {
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const data = useMemo<Template[]>(
    () => [
      { id: 1, name: translate('auto.179704494f'), channel: 'site', updated_at: '2025-01-02 12:00' },
      { id: 2, name: translate('auto.774f09f0b6'), channel: 'email', updated_at: '2025-01-04 09:12' },
    ],
    []
  )

  return (
    <Card
      title={translate('menus.notify-template')}
      extra={
        <Button type="primary" onClick={() => setOpen(true)}>
          {translate('workflowTemplates.add_template')}</Button>
      }
    >
      <Table
        rowKey="id"
        dataSource={data}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 80 },
          { title: translate('systemConfig.col_name'), dataIndex: 'name' },
          {
            title: translate('auto.c152be9f50'),
            dataIndex: 'channel',
            width: 140,
            render: (v: Template['channel']) => <Tag>{v.toUpperCase()}</Tag>,
          },
          { title: translate('papers.col_updated_at'), dataIndex: 'updated_at', width: 200, render: (v?: string) => (v ? formatDateTime(v) : '-') },
          {
            title: translate('users.columns.actions'),
            width: 200,
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

      <Modal title={translate('auto.8e67f2128b')} open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={() => setOpen(false)}>
          <Form.Item name="name" label={translate('auto.bbc511d06d')} rules={[{ required: true }]}>
            <Input placeholder={translate('auto.28b2809c4a')} />
          </Form.Item>
          <Form.Item name="content" label={translate('auto.dc3624631e')} rules={[{ required: true }]}>
            <Input.TextArea rows={6} placeholder={translate('auto.86d242f96f')} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
