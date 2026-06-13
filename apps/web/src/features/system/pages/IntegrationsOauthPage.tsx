import { useCallback, useEffect, useState } from 'react'
import { App, Button, Card, Form, Input, Modal, Space, Switch, Table, Typography } from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { integrationsApi, type Integration } from '@/shared/api/endpoints/integrations'

const { Title, Text } = Typography

type ModalState = { open: boolean; editing?: Integration | null }

export default function IntegrationsOauthPage() {
  const { message } = App.useApp()
  const [rows, setRows] = useState<Integration[]>([])
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [form] = Form.useForm<Partial<Integration>>()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const list = await integrationsApi.list('oauth')
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
    const payload = { ...values, type: 'oauth' }
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
    { title: '应用ID', dataIndex: ['config', 'clientId'], key: 'clientId', render: (_: any, record: Integration) => record?.config?.clientId || '-' },
    { title: '状态', dataIndex: 'enabled', key: 'enabled', render: (enabled: boolean) => (enabled ? '启用' : '停用') },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: Integration) => (
        <Button
          type="link"
          onClick={() => {
            setModal({ open: true, editing: record })
            form.setFieldsValue({ ...record, config: JSON.stringify(record.config || {}, null, 2) })
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
              OAuth 应用
            </Title>
            <Text type="secondary">配置第三方登录/授权</Text>
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
              新增应用
            </Button>
          </Space>
        </Space>
      </Card>
      <Card>
        <Table rowKey="id" loading={loading} dataSource={rows} columns={columns} pagination={false} />
      </Card>

      <Modal
        open={modal.open}
        title={modal.editing ? '编辑应用' : '新增应用'}
        onCancel={() => setModal({ open: false })}
        onOk={handleSave}
        destroyOnClose
      >
        <Form layout="vertical" form={form} preserve={false}>
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="授权地址" name="endpoint" rules={[{ required: true, message: '请输入授权地址' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="配置 JSON" name="config" rules={[{ required: true, message: '请输入配置' }]}>
            <Input.TextArea rows={6} placeholder='{ "clientId": "", "clientSecret": "" }' />
          </Form.Item>
          <Form.Item label="启用" name="enabled" valuePropName="checked" initialValue>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
