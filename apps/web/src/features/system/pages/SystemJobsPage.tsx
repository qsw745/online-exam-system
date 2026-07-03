import { useCallback, useEffect, useState } from 'react'
import { App, Button, Card, Form, Input, Modal, Space, Select, Table, Tag, Typography } from 'antd'
import { PlayCircleOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import type { SchedulerJob } from '@/shared/api/endpoints/jobs'
import { jobsApi } from '@/shared/api/endpoints/jobs'
import { useLanguage } from '@/shared/contexts/LanguageContext'
import { formatDateTime } from '@/shared/utils/datetime'

const { Title, Text } = Typography

type JobModal = {
  open: boolean
  editing?: SchedulerJob | null
}

export default function SystemJobsPage() {
  const { message } = App.useApp()
  const { t } = useLanguage()
  const [rows, setRows] = useState<SchedulerJob[]>([])
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState<JobModal>({ open: false })
  const [form] = Form.useForm<Partial<SchedulerJob>>()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const list = await jobsApi.list()
      setRows(list)
    } catch (e: any) {
      message.error(e?.message || t('jobs.load_failed'))
    } finally {
      setLoading(false)
    }
  }, [message, t])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSave = async () => {
    const values = await form.validateFields()
    try {
      if (modal.editing) {
        await jobsApi.update(modal.editing.id, values)
        message.success(t('jobs.update_success'))
      } else {
        await jobsApi.create(values)
        message.success(t('jobs.create_success'))
      }
      setModal({ open: false })
      form.resetFields()
      fetchData()
    } catch (e: any) {
      message.error(e?.message || t('jobs.save_failed'))
    }
  }

  const columns = [
    { title: t('jobs.col_name'), dataIndex: 'name', key: 'name' },
    { title: 'Cron', dataIndex: 'cron', key: 'cron' },
    { title: t('jobs.col_handler'), dataIndex: 'handler', key: 'handler' },
    {
      title: t('jobs.col_status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'running' ? 'green' : 'orange'}>
          {status === 'running' ? t('jobs.status_running') : t('jobs.status_paused')}
        </Tag>
      ),
    },
    { title: t('jobs.col_last_run'), dataIndex: 'last_run_at', key: 'last_run_at', render: (v?: string) => (v ? formatDateTime(v) : '-') },
    {
      title: t('jobs.col_action'),
      key: 'actions',
      render: (_: any, record: SchedulerJob) => (
        <Space>
          <Button
            type="link"
            icon={<PlayCircleOutlined />}
            onClick={() => message.info(t('jobs.scheduler_not_connected'))}
          >
            {t('jobs.trigger')}
          </Button>
          <Button
            type="link"
            onClick={() => {
              setModal({ open: true, editing: record })
              form.setFieldsValue(record)
            }}
          >
            {t('app.edit')}
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Space style={{ width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div>
            <Title level={4} style={{ marginBottom: 0 }}>
              {t('jobs.title')}
            </Title>
            <Text type="secondary">{t('jobs.description')}</Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchData} />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setModal({ open: true })
                form.resetFields()
              }}
            >
              {t('jobs.add_job')}
            </Button>
          </Space>
        </Space>
      </Card>
      <Card>
        <Table rowKey="id" loading={loading} dataSource={rows} columns={columns} pagination={false} />
      </Card>
      <Modal
        open={modal.open}
        title={modal.editing ? t('jobs.edit_job') : t('jobs.add_job')}
        onCancel={() => setModal({ open: false })}
        onOk={handleSave}
        destroyOnClose
      >
        <Form layout="vertical" form={form} preserve={false}>
          <Form.Item label={t('jobs.name')} name="name" rules={[{ required: true, message: t('jobs.name_required') }]}>
            <Input />
          </Form.Item>
          <Form.Item label={t('jobs.cron_expression')} name="cron" rules={[{ required: true, message: t('jobs.cron_required') }]}>
            <Input placeholder="0 0 * * *" />
          </Form.Item>
          <Form.Item label={t('jobs.handler')} name="handler" rules={[{ required: true, message: t('jobs.handler_required') }]}>
            <Input placeholder="module.service" />
          </Form.Item>
          <Form.Item label={t('jobs.status')} name="status" initialValue="paused">
            <Select
              options={[
                { label: t('jobs.status_paused'), value: 'paused' },
                { label: t('jobs.status_running'), value: 'running' },
              ]}
            />
          </Form.Item>
          <Form.Item label={t('jobs.remark')} name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
