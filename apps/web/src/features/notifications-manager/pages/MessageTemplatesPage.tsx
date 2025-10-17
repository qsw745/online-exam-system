import { Button, Card, Form, Input, Modal, Space, Table, Tag } from 'antd'
import React, { useMemo, useState } from 'react'

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
      { id: 1, name: '考试开始提醒', channel: 'site', updated_at: '2025-01-02 12:00' },
      { id: 2, name: '成绩发布通知', channel: 'email', updated_at: '2025-01-04 09:12' },
    ],
    []
  )

  return (
    <Card
      title="消息模板"
      extra={
        <Button type="primary" onClick={() => setOpen(true)}>
          新建模板
        </Button>
      }
    >
      <Table
        rowKey="id"
        dataSource={data}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 80 },
          { title: '名称', dataIndex: 'name' },
          {
            title: '渠道',
            dataIndex: 'channel',
            width: 140,
            render: (v: Template['channel']) => <Tag>{v.toUpperCase()}</Tag>,
          },
          { title: '更新时间', dataIndex: 'updated_at', width: 200 },
          {
            title: '操作',
            width: 200,
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

      <Modal title="模板编辑" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={() => setOpen(false)}>
          <Form.Item name="name" label="模板名称" rules={[{ required: true }]}>
            <Input placeholder="例如：考试开始提醒" />
          </Form.Item>
          <Form.Item name="content" label="模板内容" rules={[{ required: true }]}>
            <Input.TextArea rows={6} placeholder="支持变量：{examTitle}、{startTime} ..." />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
