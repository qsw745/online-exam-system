import { App, Button, Card, Form, Input, Modal, Space, Table, Tag } from 'antd'
import React, { useEffect, useMemo, useState } from 'react'
import { announcementsApi, type Announcement } from '@/shared/api/endpoints/announcements'

export default function AnnouncementManagementPage() {
  const { message } = App.useApp()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const [rows, setRows] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const list = await announcementsApi.adminList()
      setRows(list)
    } catch (e: any) {
      message.error(e?.message || '加载公告失败')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleSubmit = async (values: { title: string; content: string }) => {
    try {
      if (editing) {
        await announcementsApi.update(editing.id, { title: values.title, content: values.content })
        message.success('更新成功')
      } else {
        await announcementsApi.create({ title: values.title, content: values.content, status: 'draft' })
        message.success('创建成功')
      }
      setOpen(false)
      setEditing(null)
      form.resetFields()
      load()
    } catch (e: any) {
      message.error(e?.message || '保存失败')
    }
  }

  const handlePublish = async (record: Announcement) => {
    try {
      await announcementsApi.publish(record.id)
      message.success('发布成功')
      load()
    } catch (e: any) {
      message.error(e?.message || '发布失败')
    }
  }

  const handleDelete = async (record: Announcement) => {
    try {
      await announcementsApi.remove(record.id)
      message.success('删除成功')
      load()
    } catch (e: any) {
      message.error(e?.message || '删除失败')
    }
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      <Card
        title="公告管理"
        extra={
          <Button
            type="primary"
            onClick={() => {
              setEditing(null)
              form.resetFields()
              setOpen(true)
            }}
          >
            新建公告
          </Button>
        }
      >
        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
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
            {
              title: '发布时间',
              dataIndex: 'published_at',
              width: 200,
              render: (v: string | null) => v || '-',
            },
            {
              title: '操作',
              width: 260,
              render: (_, record) => (
                <Space>
                  <Button
                    size="small"
                    onClick={() => {
                      setEditing(record)
                      form.setFieldsValue({ title: record.title, content: record.content })
                      setOpen(true)
                    }}
                  >
                    编辑
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    disabled={record.status === 'published'}
                    onClick={() => handlePublish(record)}
                  >
                    发布
                  </Button>
                  <Button size="small" danger onClick={() => handleDelete(record)}>
                    删除
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editing ? '编辑公告' : '新建公告'}
        open={open}
        onCancel={() => {
          setOpen(false)
          setEditing(null)
          form.resetFields()
        }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
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
