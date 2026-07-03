import { useCallback, useEffect, useState } from 'react'
import {
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import type { Dictionary, DictItem } from '@/shared/api/endpoints/dicts'
import { dictsApi } from '@/shared/api/endpoints/dicts'
import { useLanguage } from '@/shared/contexts/LanguageContext'

const { Title, Text } = Typography

type DictModalState = {
  open: boolean
  editing?: Dictionary | null
}

type ItemModalState = {
  open: boolean
  dict?: Dictionary | null
  editing?: DictItem | null
}

export default function DictManagementPage() {
  const { message } = App.useApp()
  const { t } = useLanguage()
  const [data, setData] = useState<Dictionary[]>([])
  const [loading, setLoading] = useState(false)
  const [dictModal, setDictModal] = useState<DictModalState>({ open: false })
  const [itemModal, setItemModal] = useState<ItemModalState>({ open: false })
  const [dictForm] = Form.useForm<Partial<Dictionary>>()
  const [itemForm] = Form.useForm<Partial<DictItem>>()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const list = await dictsApi.list()
      setData(list)
    } catch (e: any) {
      message.error(e?.message || t('dict.load_failed'))
    } finally {
      setLoading(false)
    }
  }, [message, t])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSaveDict = async () => {
    const values = await dictForm.validateFields()
    try {
      if (dictModal.editing) {
        await dictsApi.update(dictModal.editing.id, values)
        message.success(t('dict.update_success'))
      } else {
        await dictsApi.create(values as any)
        message.success(t('dict.create_success'))
      }
      setDictModal({ open: false })
      dictForm.resetFields()
      fetchData()
    } catch (e: any) {
      message.error(e?.message || t('dict.save_failed'))
    }
  }

  const handleSaveItem = async () => {
    if (!itemModal.dict) return
    const values = await itemForm.validateFields()
    try {
      if (itemModal.editing) {
        await dictsApi.updateItem(itemModal.dict.id, itemModal.editing.id, values)
        message.success(t('dict.item_update_success'))
      } else {
        await dictsApi.createItem(itemModal.dict.id, values)
        message.success(t('dict.item_create_success'))
      }
      setItemModal({ open: false })
      itemForm.resetFields()
      fetchData()
    } catch (e: any) {
      message.error(e?.message || t('dict.save_failed'))
    }
  }

  const dictColumns = [
    { title: t('dict.col_code'), dataIndex: 'code', key: 'code' },
    { title: t('dict.col_name'), dataIndex: 'name', key: 'name' },
    {
      title: t('dict.col_status'),
      key: 'enabled',
      render: (_: any, record: Dictionary) => (record.enabled ? <Tag color="green">{t('dict.enabled')}</Tag> : <Tag color="red">{t('dict.disabled')}</Tag>),
    },
    {
      title: t('dict.col_action'),
      key: 'actions',
      render: (_: any, record: Dictionary) => (
        <Space>
          <Button
            type="link"
            onClick={() => {
              setDictModal({ open: true, editing: record })
              dictForm.setFieldsValue(record)
            }}
          >
            {t('app.edit')}
          </Button>
          <Button
            type="link"
            onClick={() => {
              setItemModal({ open: true, dict: record })
              itemForm.setFieldsValue({})
            }}
          >
            {t('dict.add_item')}
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
              {t('dict.title')}
            </Title>
            <Text type="secondary">{t('dict.description')}</Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchData} />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setDictModal({ open: true })
                dictForm.resetFields()
              }}
            >
              {t('dict.add_dict')}
            </Button>
          </Space>
        </Space>
      </Card>

      <Card loading={loading} bodyStyle={{ padding: 0 }}>
        <Table
          rowKey="id"
          dataSource={data}
          columns={dictColumns}
          expandable={{
            expandedRowRender: (dict: Dictionary) => (
              <Table
                size="small"
                rowKey="id"
                columns={[
                  { title: t('dict.col_label'), dataIndex: 'label', key: 'label' },
                  { title: t('dict.col_value'), dataIndex: 'value', key: 'value' },
                  {
                    title: t('dict.col_status'),
                    dataIndex: 'enabled',
                    key: 'enabled',
                    render: (enabled: boolean) => (enabled ? <Tag color="green">{t('dict.enabled')}</Tag> : <Tag color="red">{t('dict.disabled')}</Tag>),
                  },
                  {
                    title: t('dict.col_action'),
                    key: 'action',
                    render: (_: any, record: DictItem) => (
                      <Button
                        type="link"
                        onClick={() => {
                          setItemModal({ open: true, dict, editing: record })
                          itemForm.setFieldsValue(record)
                        }}
                      >
                        {t('app.edit')}
                      </Button>
                    ),
                  },
                ]}
                dataSource={dict.items}
                pagination={false}
              />
            ),
          }}
        />
      </Card>

      <Modal
        title={dictModal.editing ? t('dict.edit_dict') : t('dict.add_dict')}
        open={dictModal.open}
        onCancel={() => setDictModal({ open: false })}
        onOk={handleSaveDict}
        destroyOnClose
      >
        <Form layout="vertical" form={dictForm} preserve={false}>
          <Form.Item label={t('dict.code')} name="code" rules={[{ required: true, message: t('dict.code_required') }]}>
            <Input placeholder={t('dict.code_placeholder')} maxLength={50} />
          </Form.Item>
          <Form.Item label={t('dict.name')} name="name" rules={[{ required: true, message: t('dict.name_required') }]}>
            <Input placeholder={t('dict.name_placeholder')} />
          </Form.Item>
          <Form.Item label={t('dict.description_label')} name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label={t('dict.enabled')} name="enabled" valuePropName="checked" initialValue>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={itemModal.editing ? t('dict.edit_item') : t('dict.add_item_for').replace('{name}', itemModal.dict?.name || '')}
        open={itemModal.open}
        onCancel={() => setItemModal({ open: false })}
        onOk={handleSaveItem}
        destroyOnClose
      >
        <Form layout="vertical" form={itemForm} preserve={false}>
          <Form.Item label={t('dict.label')} name="label" rules={[{ required: true, message: t('dict.label_required') }]}>
            <Input />
          </Form.Item>
          <Form.Item label={t('dict.value')} name="value" rules={[{ required: true, message: t('dict.value_required') }]}>
            <Input />
          </Form.Item>
          <Form.Item label={t('dict.tag')} name="tag">
            <Input />
          </Form.Item>
          <Form.Item label={t('dict.enabled')} name="enabled" valuePropName="checked" initialValue>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
