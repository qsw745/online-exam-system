import { useCallback, useEffect, useState } from 'react'
import { App, Button, Card, Form, Input, Modal, Select, Space, Switch, Table, Typography } from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import type { SystemConfig } from '@/shared/api/endpoints/systemConfigs'
import { systemConfigsApi } from '@/shared/api/endpoints/systemConfigs'

const { Title, Text } = Typography

type ModalState = {
  open: boolean
  editing?: SystemConfig | null
}

export default function SystemConfigPage() {
  const { message } = App.useApp()
  const [rows, setRows] = useState<SystemConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [form] = Form.useForm<Partial<SystemConfig>>()
  const [antiCheatLoading, setAntiCheatLoading] = useState(false)
  const [attachLoading, setAttachLoading] = useState(false)
  const [attachSize, setAttachSize] = useState('20')
  const [attachTypes, setAttachTypes] = useState('pdf,doc,docx,xls,xlsx,ppt,pptx,zip,png,jpg,jpeg')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const list = await systemConfigsApi.list()
      setRows(list)
    } catch (e: any) {
      message.error(e?.message || '加载配置失败')
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const antiCheatConfig = rows.find(r => r.config_key === 'exam.anticheat.level')
  const attachSizeConfig = rows.find(r => r.config_key === 'notify.attach.maxSizeMB')
  const attachTypesConfig = rows.find(r => r.config_key === 'notify.attach.allowedTypes')

  useEffect(() => {
    if (attachSizeConfig) setAttachSize(attachSizeConfig.config_value || '20')
    if (attachTypesConfig) setAttachTypes(attachTypesConfig.config_value || '')
  }, [attachSizeConfig, attachTypesConfig])

  const handleAntiCheatChange = async (value: string) => {
    setAntiCheatLoading(true)
    try {
      if (antiCheatConfig) {
        await systemConfigsApi.update(antiCheatConfig.id, { config_value: value })
      } else {
        await systemConfigsApi.create({
          config_key: 'exam.anticheat.level',
          config_name: '考试防作弊等级',
          config_value: value,
          value_type: 'select',
          enabled: true,
        })
      }
      message.success('防作弊等级已更新')
      fetchData()
    } catch (e: any) {
      message.error(e?.message || '更新失败')
    } finally {
      setAntiCheatLoading(false)
    }
  }

  const handleAttachSave = async () => {
    setAttachLoading(true)
    try {
      if (attachSizeConfig) await systemConfigsApi.update(attachSizeConfig.id, { config_value: attachSize })
      else
        await systemConfigsApi.create({
          config_key: 'notify.attach.maxSizeMB',
          config_name: '通知附件最大大小(MB)',
          config_value: attachSize,
          value_type: 'number',
          enabled: true,
        })

      if (attachTypesConfig) await systemConfigsApi.update(attachTypesConfig.id, { config_value: attachTypes })
      else
        await systemConfigsApi.create({
          config_key: 'notify.attach.allowedTypes',
          config_name: '通知附件允许的后缀',
          config_value: attachTypes,
          value_type: 'text',
          enabled: true,
        })
      message.success('附件上传限制已更新')
      fetchData()
    } catch (e: any) {
      message.error(e?.message || '更新失败')
    } finally {
      setAttachLoading(false)
    }
  }

  const handleSave = async () => {
    const values = await form.validateFields()
    try {
      if (modal.editing) {
        await systemConfigsApi.update(modal.editing.id, values)
        message.success('更新成功')
      } else {
        await systemConfigsApi.create(values)
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
    { title: '键', dataIndex: 'config_key', key: 'config_key' },
    { title: '名称', dataIndex: 'config_name', key: 'config_name' },
    { title: '值', dataIndex: 'config_value', key: 'config_value' },
    {
      title: '类型',
      dataIndex: 'value_type',
      key: 'value_type',
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean) => (enabled ? '是' : '否'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: SystemConfig) => (
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
              参数设置
            </Title>
            <Text type="secondary">全局配置项，可即时修改</Text>
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
              新增配置
            </Button>
          </Space>
        </Space>
      </Card>
      <Card title="考试防作弊" extra={antiCheatConfig?.description}>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Text type="secondary">选择不同级别，可控制考试过程中对切屏、复制等行为的限制。</Text>
          <Select
            value={antiCheatConfig?.config_value || 'basic'}
            onChange={handleAntiCheatChange}
            loading={antiCheatLoading}
            style={{ width: 240 }}
            options={[
              { label: '关闭 - 不启用防作弊', value: 'none' },
              { label: '基础 - 提醒并禁止复制', value: 'basic' },
              { label: '严格 - 切屏一次即自动提交', value: 'strict' },
            ]}
          />
        </Space>
      </Card>
      <Card title="通知附件上传">
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Text type="secondary">控制通知发送时可上传附件的大小和格式。</Text>
          <Space align="baseline">
            <span>最大大小(MB)：</span>
            <Input
              style={{ width: 120 }}
              value={attachSize}
              onChange={e => setAttachSize(e.target.value)}
            />
          </Space>
          <Space align="baseline">
            <span>允许格式：</span>
            <Input
              style={{ width: 360 }}
              value={attachTypes}
              onChange={e => setAttachTypes(e.target.value)}
              placeholder="例如：pdf,docx,zip"
            />
          </Space>
          <Button type="primary" onClick={handleAttachSave} loading={attachLoading} style={{ width: 160 }}>
            保存设置
          </Button>
        </Space>
      </Card>
      <Card>
        <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} pagination={false} />
      </Card>
      <Modal
        open={modal.open}
        title={modal.editing ? '编辑配置' : '新增配置'}
        onCancel={() => setModal({ open: false })}
        onOk={handleSave}
        destroyOnClose
      >
        <Form layout="vertical" form={form} preserve={false}>
          <Form.Item label="配置键" name="config_key" rules={[{ required: true, message: '请输入配置键' }]}>
            <Input disabled={!!modal.editing} />
          </Form.Item>
          <Form.Item label="名称" name="config_name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="值" name="config_value">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label="类型" name="value_type" initialValue="text">
            <Input placeholder="text/json/number" />
          </Form.Item>
          <Form.Item label="启用" name="enabled" valuePropName="checked" initialValue>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
