import { App, Button, Card, Form, Input, Modal, Space, Table, Tag } from 'antd'
import React, { useEffect, useMemo, useState } from 'react'
import { announcementsApi, type Announcement } from '@/shared/api/endpoints/announcements'
import { translate } from '@/shared/utils/i18n'
import { formatDateTime } from '@/shared/utils/datetime'

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
      message.error(e?.message || translate('auto.a55cbaa016'))
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
        message.success(translate('roles.message.update_success'))
      } else {
        await announcementsApi.create({ title: values.title, content: values.content, status: 'draft' })
        message.success(translate('orgs.message.create_success'))
      }
      setOpen(false)
      setEditing(null)
      form.resetFields()
      load()
    } catch (e: any) {
      message.error(e?.message || translate('roles.message.save_failed'))
    }
  }

  const handlePublish = async (record: Announcement) => {
    try {
      await announcementsApi.publish(record.id)
      message.success(translate('auto.ec00233618'))
      load()
    } catch (e: any) {
      message.error(e?.message || translate('auto.7e7f5d44c4'))
    }
  }

  const handleDelete = async (record: Announcement) => {
    try {
      await announcementsApi.remove(record.id)
      message.success(translate('users.message.delete_success'))
      load()
    } catch (e: any) {
      message.error(e?.message || translate('orgs.message.delete_failed'))
    }
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      <Card
        title={translate('menus.notify-announce-manage')}
        extra={
          <Button
            type="primary"
            onClick={() => {
              setEditing(null)
              form.resetFields()
              setOpen(true)
            }}
          >
            {translate('auto.5ae1741c4b')}</Button>
        }
      >
        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
          columns={[
            { title: 'ID', dataIndex: 'id', width: 80 },
            { title: translate('papers.field_title'), dataIndex: 'title' },
            {
              title: translate('users.columns.status'),
              dataIndex: 'status',
              width: 120,
              render: (v: Announcement['status']) =>
                v === 'published' ? <Tag color="green">{translate('auto.176a2eb4eb')}</Tag> : <Tag>{translate('auto.0f436818c0')}</Tag>,
            },
            {
              title: translate('auto.b410c24122'),
              dataIndex: 'published_at',
              width: 200,
              render: (v: string | null) => (v ? formatDateTime(v) : '-'),
            },
            {
              title: translate('users.columns.actions'),
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
                    {translate('app.edit')}</Button>
                  <Button
                    size="small"
                    type="primary"
                    disabled={record.status === 'published'}
                    onClick={() => handlePublish(record)}
                  >
                    {translate('auto.94f172d02f')}</Button>
                  <Button size="small" danger onClick={() => handleDelete(record)}>
                    {translate('app.delete')}</Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editing ? translate('visible.0d7fef7db2') : translate('auto.5ae1741c4b')}
        open={open}
        onCancel={() => {
          setOpen(false)
          setEditing(null)
          form.resetFields()
        }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="title" label={translate('papers.field_title')} rules={[{ required: true, message: translate('auto.901722e5f3') }]}>
            <Input placeholder={translate('auto.896fd7dbf3')} />
          </Form.Item>
          <Form.Item name="content" label={translate('auto.163aec9194')} rules={[{ required: true, message: translate('auto.ac962cb9a6') }]}>
            <Input.TextArea rows={6} placeholder={translate('auto.927b94adc0')} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
