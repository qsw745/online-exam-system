import { useCallback, useEffect, useState } from 'react'
import { App, Button, Card, Form, Input, Modal, Space, Switch, Table, Typography } from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { integrationsApi, type Integration } from '@/shared/api/endpoints/integrations'
import { translate } from '@/shared/utils/i18n'

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
      message.error(e?.message || translate('common.load_failed'))
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
        message.success(translate('roles.message.update_success'))
      } else {
        await integrationsApi.create(payload)
        message.success(translate('orgs.message.create_success'))
      }
      setModal({ open: false })
      form.resetFields()
      fetchData()
    } catch (e: any) {
      message.error(e?.message || translate('roles.message.save_failed'))
    }
  }

  const columns = [
    { title: translate('systemConfig.col_name'), dataIndex: 'name', key: 'name' },
    { title: translate('auto.bce6707cff'), dataIndex: 'endpoint', key: 'endpoint' },
    { title: translate('papers.field_desc'), dataIndex: 'description', key: 'description' },
    {
      title: translate('users.status.enable'),
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean) => (enabled ? '是' : '否'),
    },
    {
      title: translate('users.columns.actions'),
      key: 'actions',
      render: (_: any, record: Integration) => (
        <Button
          type="link"
          onClick={() => {
            setModal({ open: true, editing: record })
            form.setFieldsValue(record)
          }}
        >
          {translate('app.edit')}</Button>
      ),
    },
  ]

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Space style={{ width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div>
            <Title level={4} style={{ marginBottom: 0 }}>
              {translate('auto.dc515daed5')}</Title>
            <Text type="secondary">{translate('auto.84c1dd3d04')}</Text>
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
              {translate('auto.a7fa02690a')}</Button>
          </Space>
        </Space>
      </Card>
      <Card>
        <Table rowKey="id" loading={loading} dataSource={rows} columns={columns} pagination={false} />
      </Card>

      <Modal
        title={modal.editing ? translate('visible.d851bc608a') : translate('visible.78cb758aca')}
        open={modal.open}
        onCancel={() => setModal({ open: false })}
        onOk={handleSave}
        destroyOnClose
      >
        <Form layout="vertical" form={form} preserve={false}>
          <Form.Item label={translate('systemConfig.col_name')} name="name" rules={[{ required: true, message: translate('systemConfig.config_name_required') }]}>
            <Input />
          </Form.Item>
          <Form.Item label={translate('auto.bce6707cff')} name="endpoint" rules={[{ required: true, message: translate('auto.c2b8641ecc') }]}>
            <Input placeholder="https://example.com/webhook" />
          </Form.Item>
          <Form.Item label={translate('users.status.enable')} name="enabled" valuePropName="checked" initialValue>
            <Switch />
          </Form.Item>
          <Form.Item label={translate('papers.field_desc')} name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
