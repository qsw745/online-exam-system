import { Button, Card, Form, Input, Modal, Space, Table, Tag } from 'antd'
import React, { useMemo, useState } from 'react'

type Announcement = {
  id: number
  title: string
  status: 'draft' | 'published'
  updated_at: string
}

export default function AnnouncementManagementPage() {
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  // TODO: 替换为接口数据
  const data = useMemo<Announcement[]>(
    () => [
      { id: 1, title: '系统维护公告', status: 'published', updated_at: '2025-01-05 10:00' },
      { id: 2, title: '新版功能上线', status: 'draft', updated_at: '2025-01-03 18:22' },
    ],
    []
  )

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      <Card
        title="公告管理"
        extra={
          <Button type="primary" onClick={() => setOpen(true)}>
            新建公告
          </Button>
        }
      >
        <Table
          rowKey="id"
          dataSource={data}
          columns={[
            { title: 'ID', dataIndex: 'id', width: 80 },
            { title: '标题', dataIndex: 'title' },
            {
              title: '状态',
              dataIndex: 'status',
              width: 120,
              render: (v: Announcement['status']) =>
                v === 'published' ? <Tag color="green">已发布</Tag> : <Tag>草稿</Tag>,
            },
            { title: '更新时间', dataIndex: 'updated_at', width: 200 },
            {
              title: '操作',
              width: 220,
              render: (_, r) => (
                <Space>
                  <Button size="small" onClick={() => setOpen(true)}>
                    编辑
                  </Button>
                  <Button size="small" type="primary">
                    发布
                  </Button>
                  <Button size="small" danger>
                    删除
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal title="公告编辑" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={() => setOpen(false)}>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="例如：系统维护公告" />
          </Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true, message: '请输入内容' }]}>
            <Input.TextArea rows={6} placeholder="支持 Markdown / 富文本（后续接编辑器）" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
