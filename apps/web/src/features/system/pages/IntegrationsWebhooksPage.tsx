import { useCallback, useEffect, useState } from 'react'
import { App, Button, Card, Form, Input, Modal, Space, Switch, Table, Typography } from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { integrationsApi, type Integration } from '@/shared/api/endpoints/integrations'

const { Title, Text } = Typography

type ModalState = { open: boolean; editing?: Integration | null }

export default function IntegrationsWebhooksPage() {
  const { message } = App.useApp()
  const [rows, setRows] = useState<Integration[]>([])
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [form] = Form.useForm<Partial<Integration>>()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const list = await integrationsApi.list('webhook')
      setRows(list)
    } catch (e: any) {
      message.error(e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSave = async () => {
    const values = await form.validateFields()
    const payload = { ...values, type: 'webhook' }
    try {
      if (modal.editing) {
        await integrationsApi.update(modal.editing.id, payload)
        message.success('更新成功')
      } else {
        await integrationsApi.create(payload)
        message.success('创建成功')
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
    { title: '回调地址', dataIndex: 'endpoint', key: 'endpoint' },
    { title: '说明', dataIndex: 'description', key: 'description' },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean) => (enabled ? '是' : '否'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: Integration) => (
        <Button
          type="link"
          onClick={() => {
            setModal({ open: true, editing: record })
            form.setFieldsValue(record)
          }}
        >
          编辑
        </Button>
      ),
    },
  ]

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Space style={{ width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div>
            <Title level={4} style={{ marginBottom: 0 }}>
              Webhook 集成
            </Title>
            <Text type="secondary">管理推送地址及密钥</Text>
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
              新增集成
            </Button>
          </Space>
        </Space>
      </Card>
      <Card>
        <Table rowKey="id" loading={loading} dataSource={rows} columns={columns} pagination={false} />
      </Card>

      <Modal
        title={modal.editing ? '编辑 Webhook' : '新增 Webhook'}
        open={modal.open}
        onCancel={() => setModal({ open: false })}
        onOk={handleSave}
        destroyOnClose
      >
        <Form layout="vertical" form={form} preserve={false}>
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="回调地址" name="endpoint" rules={[{ required: true, message: '请输入 URL' }]}>
            <Input placeholder="https://example.com/webhook" />
          </Form.Item>
          <Form.Item label="启用" name="enabled" valuePropName="checked" initialValue>
            <Switch />
          </Form.Item>
          <Form.Item label="说明" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
