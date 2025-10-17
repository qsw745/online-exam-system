import { Button, Card, Form, Input, Modal, Space, Switch, Table, Tag } from 'antd'
import React, { useMemo, useState } from 'react'

type Channel = { id: number; code: string; name: string; enabled: boolean; remark?: string }

export default function ChannelsPage() {
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const data = useMemo<Channel[]>(
    () => [
      { id: 1, code: 'site', name: '站内信', enabled: true },
      { id: 2, code: 'email', name: '邮件', enabled: true },
      { id: 3, code: 'sms', name: '短信', enabled: false, remark: '需配置供应商' },
      { id: 4, code: 'webhook', name: 'Webhook', enabled: false },
    ],
    []
  )

  return (
    <Card title="推送渠道" extra={<Button onClick={() => setOpen(true)}>新增渠道</Button>}>
      <Table
        rowKey="id"
        dataSource={data}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 80 },
          { title: '编码', dataIndex: 'code', width: 140, render: v => <Tag>{v}</Tag> },
          { title: '名称', dataIndex: 'name' },
          { title: '启用', dataIndex: 'enabled', width: 120, render: (v: boolean) => <Switch checked={v} /> },
          { title: '备注', dataIndex: 'remark' },
          {
            title: '操作',
            width: 160,
            render: () => (
              <Space>
                <Button size="small" onClick={() => setOpen(true)}>
                  编辑
                </Button>
                <Button size="small" danger>
                  删除
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal title="渠道配置" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={() => setOpen(false)}>
          <Form.Item name="code" label="渠道编码" rules={[{ required: true }]}>
            <Input placeholder="site / email / sms / webhook" />
          </Form.Item>
          <Form.Item name="name" label="渠道名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="config" label="配置(JSON)">
            <Input.TextArea rows={6} placeholder='例如：{"apiKey":"xxx"}' />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
