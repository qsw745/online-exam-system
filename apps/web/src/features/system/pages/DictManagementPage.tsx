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
      message.error(e?.message || '加载字典失败')
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSaveDict = async () => {
    const values = await dictForm.validateFields()
    try {
      if (dictModal.editing) {
        await dictsApi.update(dictModal.editing.id, values)
        message.success('更新字典成功')
      } else {
        await dictsApi.create(values as any)
        message.success('创建字典成功')
      }
      setDictModal({ open: false })
      dictForm.resetFields()
      fetchData()
    } catch (e: any) {
      message.error(e?.message || '保存失败')
    }
  }

  const handleSaveItem = async () => {
    if (!itemModal.dict) return
    const values = await itemForm.validateFields()
    try {
      if (itemModal.editing) {
        await dictsApi.updateItem(itemModal.dict.id, itemModal.editing.id, values)
        message.success('更新条目成功')
      } else {
        await dictsApi.createItem(itemModal.dict.id, values)
        message.success('创建条目成功')
      }
      setItemModal({ open: false })
      itemForm.resetFields()
      fetchData()
    } catch (e: any) {
      message.error(e?.message || '保存失败')
    }
  }

  const dictColumns = [
    { title: '编码', dataIndex: 'code', key: 'code' },
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '状态',
      key: 'enabled',
      render: (_: any, record: Dictionary) => (record.enabled ? <Tag color="green">启用</Tag> : <Tag color="red">停用</Tag>),
    },
    {
      title: '操作',
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
            编辑
          </Button>
          <Button
            type="link"
            onClick={() => {
              setItemModal({ open: true, dict: record })
              itemForm.setFieldsValue({})
            }}
          >
            新增条目
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
              字典管理
            </Title>
            <Text type="secondary">维护系统通用的字典及其条目</Text>
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
              新增字典
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
                  { title: '标签', dataIndex: 'label', key: 'label' },
                  { title: '值', dataIndex: 'value', key: 'value' },
                  {
                    title: '状态',
                    dataIndex: 'enabled',
                    key: 'enabled',
                    render: (enabled: boolean) => (enabled ? <Tag color="green">启用</Tag> : <Tag color="red">停用</Tag>),
                  },
                  {
                    title: '操作',
                    key: 'action',
                    render: (_: any, record: DictItem) => (
                      <Button
                        type="link"
                        onClick={() => {
                          setItemModal({ open: true, dict, editing: record })
                          itemForm.setFieldsValue(record)
                        }}
                      >
                        编辑
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
        title={dictModal.editing ? '编辑字典' : '新增字典'}
        open={dictModal.open}
        onCancel={() => setDictModal({ open: false })}
        onOk={handleSaveDict}
        destroyOnClose
      >
        <Form layout="vertical" form={dictForm} preserve={false}>
          <Form.Item label="编码" name="code" rules={[{ required: true, message: '请输入编码' }]}>
            <Input placeholder="例如 gender" maxLength={50} />
          </Form.Item>
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="显示名称" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="启用" name="enabled" valuePropName="checked" initialValue>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={itemModal.editing ? '编辑条目' : `新增条目 - ${itemModal.dict?.name || ''}`}
        open={itemModal.open}
        onCancel={() => setItemModal({ open: false })}
        onOk={handleSaveItem}
        destroyOnClose
      >
        <Form layout="vertical" form={itemForm} preserve={false}>
          <Form.Item label="标签" name="label" rules={[{ required: true, message: '请输入标签' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="值" name="value" rules={[{ required: true, message: '请输入值' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="标记" name="tag">
            <Input />
          </Form.Item>
          <Form.Item label="启用" name="enabled" valuePropName="checked" initialValue>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
