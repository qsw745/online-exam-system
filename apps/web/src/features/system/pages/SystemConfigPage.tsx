import { useCallback, useEffect, useState } from 'react'
import { App, Button, Card, Form, Input, Modal, Select, Space, Switch, Table, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { Breakpoint } from 'antd/es/_util/responsiveObserver'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import type { SystemConfig } from '@/shared/api/endpoints/systemConfigs'
import { systemConfigsApi } from '@/shared/api/endpoints/systemConfigs'
import { useLanguage } from '@/shared/contexts/LanguageContext'

const { Title, Text } = Typography

type ModalState = {
  open: boolean
  editing?: SystemConfig | null
}

export default function SystemConfigPage() {
  const { message } = App.useApp()
  const { t } = useLanguage()
  const [rows, setRows] = useState<SystemConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [form] = Form.useForm<Partial<SystemConfig>>()
  const [antiCheatLoading, setAntiCheatLoading] = useState(false)
  const [proctoringLoading, setProctoringLoading] = useState(false)
  const [attachLoading, setAttachLoading] = useState(false)
  const [attachSize, setAttachSize] = useState('20')
  const [attachTypes, setAttachTypes] = useState('pdf,doc,docx,xls,xlsx,ppt,pptx,zip,png,jpg,jpeg')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const list = await systemConfigsApi.list()
      setRows(list)
    } catch (e: any) {
      message.error(e?.message || t('systemConfig.load_failed'))
    } finally {
      setLoading(false)
    }
  }, [message, t])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const antiCheatConfig = rows.find(r => r.config_key === 'exam.anticheat.level')
  const proctoringConfig = rows.find(r => r.config_key === 'exam.proctoring.level')
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
          config_name: t('systemConfig.anti_cheat_name'),
          config_value: value,
          value_type: 'select',
          enabled: true,
        })
      }
      message.success(t('systemConfig.anti_cheat_updated'))
      fetchData()
    } catch (e: any) {
      message.error(e?.message || t('systemConfig.update_failed'))
    } finally {
      setAntiCheatLoading(false)
    }
  }

  const handleProctoringChange = async (value: string) => {
    setProctoringLoading(true)
    try {
      if (proctoringConfig) {
        await systemConfigsApi.update(proctoringConfig.id, { config_value: value })
      } else {
        await systemConfigsApi.create({
          config_key: 'exam.proctoring.level',
          config_name: t('systemConfig.proctoring_name'),
          config_value: value,
          value_type: 'select',
          enabled: true,
        })
      }
      message.success(t('systemConfig.proctoring_updated'))
      fetchData()
    } catch (e: any) {
      message.error(e?.message || t('systemConfig.update_failed'))
    } finally {
      setProctoringLoading(false)
    }
  }

  const handleAttachSave = async () => {
    setAttachLoading(true)
    try {
      if (attachSizeConfig) await systemConfigsApi.update(attachSizeConfig.id, { config_value: attachSize })
      else
        await systemConfigsApi.create({
          config_key: 'notify.attach.maxSizeMB',
          config_name: t('systemConfig.attach_size_name'),
          config_value: attachSize,
          value_type: 'number',
          enabled: true,
        })

      if (attachTypesConfig) await systemConfigsApi.update(attachTypesConfig.id, { config_value: attachTypes })
      else
        await systemConfigsApi.create({
          config_key: 'notify.attach.allowedTypes',
          config_name: t('systemConfig.attach_types_name'),
          config_value: attachTypes,
          value_type: 'text',
          enabled: true,
        })
      message.success(t('systemConfig.attach_updated'))
      fetchData()
    } catch (e: any) {
      message.error(e?.message || t('systemConfig.update_failed'))
    } finally {
      setAttachLoading(false)
    }
  }

  const handleSave = async () => {
    const values = await form.validateFields()
    try {
      if (modal.editing) {
        await systemConfigsApi.update(modal.editing.id, values)
        message.success(t('systemConfig.update_success'))
      } else {
        await systemConfigsApi.create(values)
        message.success(t('systemConfig.create_success'))
      }
      setModal({ open: false })
      form.resetFields()
      fetchData()
    } catch (e: any) {
      message.error(e?.message || t('systemConfig.save_failed'))
    }
  }

  const columns: ColumnsType<SystemConfig> = [
    { title: t('systemConfig.col_key'), dataIndex: 'config_key', key: 'config_key', ellipsis: true },
    { title: t('systemConfig.col_name'), dataIndex: 'config_name', key: 'config_name', ellipsis: true },
    { title: t('systemConfig.col_value'), dataIndex: 'config_value', key: 'config_value', ellipsis: true },
    {
      title: t('systemConfig.col_type'),
      dataIndex: 'value_type',
      key: 'value_type',
      responsive: ['md'] as Breakpoint[],
    },
    {
      title: t('systemConfig.col_enabled'),
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean) => (enabled ? t('systemConfig.yes') : t('systemConfig.no')),
    },
    {
      title: t('systemConfig.col_action'),
      key: 'actions',
      render: (_: any, record: SystemConfig) => (
        <Button
          type="link"
          onClick={() => {
            setModal({ open: true, editing: record })
            form.setFieldsValue(record)
          }}
        >
          {t('app.edit')}
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
              {t('systemConfig.title')}
            </Title>
            <Text type="secondary">{t('systemConfig.description')}</Text>
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
              {t('systemConfig.add_config')}
            </Button>
          </Space>
        </Space>
      </Card>
      <Card title={t('systemConfig.anti_cheat')} extra={antiCheatConfig?.description}>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Text type="secondary">{t('systemConfig.anti_cheat_desc')}</Text>
          <Select
            value={antiCheatConfig?.config_value || 'basic'}
            onChange={handleAntiCheatChange}
            loading={antiCheatLoading}
            style={{ width: 240 }}
            options={[
              { label: t('systemConfig.anti_cheat_none'), value: 'none' },
              { label: t('systemConfig.anti_cheat_basic'), value: 'basic' },
              { label: t('systemConfig.anti_cheat_strict'), value: 'strict' },
            ]}
          />
        </Space>
      </Card>
      <Card title={t('systemConfig.proctoring')} extra={proctoringConfig?.description}>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Text type="secondary">{t('systemConfig.proctoring_desc')}</Text>
          <Select
            value={proctoringConfig?.config_value || 'basic'}
            onChange={handleProctoringChange}
            loading={proctoringLoading}
            style={{ width: 240 }}
            options={[
              { label: t('systemConfig.proctoring_off'), value: 'off' },
              { label: t('systemConfig.proctoring_basic'), value: 'basic' },
              { label: t('systemConfig.proctoring_strict'), value: 'strict' },
            ]}
          />
        </Space>
      </Card>
      <Card title={t('systemConfig.attach_upload')}>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Text type="secondary">{t('systemConfig.attach_desc')}</Text>
          <Space align="baseline">
            <span>{t('systemConfig.max_size_mb')}</span>
            <Input
              style={{ width: 120 }}
              value={attachSize}
              onChange={e => setAttachSize(e.target.value)}
            />
          </Space>
          <Space align="baseline">
            <span>{t('systemConfig.allowed_types')}</span>
            <Input
              style={{ width: 360 }}
              value={attachTypes}
              onChange={e => setAttachTypes(e.target.value)}
              placeholder={t('systemConfig.allowed_types_placeholder')}
            />
          </Space>
          <Button type="primary" onClick={handleAttachSave} loading={attachLoading} style={{ width: 160 }}>
            {t('settings.save')}
          </Button>
        </Space>
      </Card>
      <Card>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          pagination={false}
          size="small"
          scroll={{ x: 900 }}
        />
      </Card>
      <Modal
        open={modal.open}
        title={modal.editing ? t('systemConfig.edit_config') : t('systemConfig.add_config')}
        onCancel={() => setModal({ open: false })}
        onOk={handleSave}
        destroyOnClose
      >
        <Form layout="vertical" form={form} preserve={false}>
          <Form.Item label={t('systemConfig.config_key')} name="config_key" rules={[{ required: true, message: t('systemConfig.config_key_required') }]}>
            <Input disabled={!!modal.editing} />
          </Form.Item>
          <Form.Item label={t('systemConfig.config_name')} name="config_name" rules={[{ required: true, message: t('systemConfig.config_name_required') }]}>
            <Input />
          </Form.Item>
          <Form.Item label={t('systemConfig.config_value')} name="config_value">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label={t('systemConfig.value_type')} name="value_type" initialValue="text">
            <Input placeholder="text/json/number" />
          </Form.Item>
          <Form.Item label={t('systemConfig.enabled')} name="enabled" valuePropName="checked" initialValue>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
