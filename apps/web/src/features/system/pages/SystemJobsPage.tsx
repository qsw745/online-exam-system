import { useCallback, useEffect, useState } from 'react'
import { App, Button, Card, Form, Input, Modal, Space, Select, Table, Tag, Typography } from 'antd'
import { PlayCircleOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import type { SchedulerJob } from '@/shared/api/endpoints/jobs'
import { jobsApi } from '@/shared/api/endpoints/jobs'

const { Title, Text } = Typography

type JobModal = {
  open: boolean
  editing?: SchedulerJob | null
}

export default function SystemJobsPage() {
  const { message } = App.useApp()
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
      message.error(e?.message || '加载任务失败')
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSave = async () => {
    const values = await form.validateFields()
    try {
      if (modal.editing) {
        await jobsApi.update(modal.editing.id, values)
        message.success('更新任务成功')
      } else {
        await jobsApi.create(values)
        message.success('创建任务成功')
      }
      setModal({ open: false })
      form.resetFields()
      fetchData()
    } catch (e: any) {
      message.error(e?.message || '保存失败')
    }
  }

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: 'Cron', dataIndex: 'cron', key: 'cron' },
    { title: '执行器', dataIndex: 'handler', key: 'handler' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag color={status === 'running' ? 'green' : 'orange'}>{status}</Tag>,
    },
    { title: '上次执行', dataIndex: 'last_run_at', key: 'last_run_at' },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: SchedulerJob) => (
        <Space>
          <Button
            type="link"
            icon={<PlayCircleOutlined />}
            onClick={() => message.info('暂未接入调度器，待补充')}
          >
            触发
          </Button>
          <Button
            type="link"
            onClick={() => {
              setModal({ open: true, editing: record })
              form.setFieldsValue(record)
            }}
          >
            编辑
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
              定时任务
            </Title>
            <Text type="secondary">管理后台 cron 任务</Text>
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
              新增任务
            </Button>
          </Space>
        </Space>
      </Card>
      <Card>
        <Table rowKey="id" loading={loading} dataSource={rows} columns={columns} pagination={false} />
      </Card>
      <Modal
        open={modal.open}
        title={modal.editing ? '编辑任务' : '新增任务'}
        onCancel={() => setModal({ open: false })}
        onOk={handleSave}
        destroyOnClose
      >
        <Form layout="vertical" form={form} preserve={false}>
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Cron 表达式" name="cron" rules={[{ required: true, message: '请输入 Cron' }]}>
            <Input placeholder="0 0 * * *" />
          </Form.Item>
          <Form.Item label="执行器" name="handler" rules={[{ required: true, message: '请输入执行器' }]}>
            <Input placeholder="module.service" />
          </Form.Item>
          <Form.Item label="状态" name="status" initialValue="paused">
            <Select
              options={[
                { label: '暂停', value: 'paused' },
                { label: '运行中', value: 'running' },
              ]}
            />
          </Form.Item>
          <Form.Item label="备注" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
