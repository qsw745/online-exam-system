import { useCallback, useEffect, useState } from 'react'
import { App, Button, Card, Form, Input, Modal, Space, Switch, Table, Typography } from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { integrationsApi, type Integration } from '@/shared/api/endpoints/integrations'
import { translate } from '@/shared/utils/i18n'

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
    const payload = { ...values, type: 'oauth' }
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
    { title: translate('auto.be8af550f3'), dataIndex: ['config', 'clientId'], key: 'clientId', render: (_: any, record: Integration) => record?.config?.clientId || '-' },
    { title: translate('users.columns.status'), dataIndex: 'enabled', key: 'enabled', render: (enabled: boolean) => (enabled ? '启用' : '停用') },
    {
      title: translate('users.columns.actions'),
      key: 'actions',
      render: (_: any, record: Integration) => (
        <Button
          type="link"
          onClick={() => {
            setModal({ open: true, editing: record })
            form.setFieldsValue({ ...record, config: JSON.stringify(record.config || {}, null, 2) })
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
              {translate('auto.270ed72096')}</Title>
            <Text type="secondary">{translate('auto.ca9dcd27b9')}</Text>
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
              {translate('auto.279904a6b8')}</Button>
          </Space>
        </Space>
      </Card>
      <Card>
        <Table rowKey="id" loading={loading} dataSource={rows} columns={columns} pagination={false} />
      </Card>

      <Modal
        open={modal.open}
        title={modal.editing ? translate('visible.d340993263') : translate('auto.279904a6b8')}
        onCancel={() => setModal({ open: false })}
        onOk={handleSave}
        destroyOnClose
      >
        <Form layout="vertical" form={form} preserve={false}>
          <Form.Item label={translate('systemConfig.col_name')} name="name" rules={[{ required: true, message: translate('systemConfig.config_name_required') }]}>
            <Input />
          </Form.Item>
          <Form.Item label={translate('auto.1688129b62')} name="endpoint" rules={[{ required: true, message: translate('auto.8d251ea411') }]}>
            <Input />
          </Form.Item>
          <Form.Item label={translate('auto.88beb0e1dd')} name="config" rules={[{ required: true, message: translate('auto.3f8462ab01') }]}>
            <Input.TextArea rows={6} placeholder='{ "clientId": "", "clientSecret": "" }' />
          </Form.Item>
          <Form.Item label={translate('users.status.enable')} name="enabled" valuePropName="checked" initialValue>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
