import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Layout,
  message,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Switch,
  Tree,
  Typography,
} from 'antd'
import type { DataNode, EventDataNode } from 'antd/es/tree'
import React, { useEffect, useMemo, useState } from 'react'
import { OrgAPI, type OrgNode } from '../../lib/orgs/api' // ✅ 使用库里定义的 OrgNode，不再本地声明

const { Sider, Content } = Layout
const { Title, Text } = Typography

// ====== 辅助：把后端树转 antd TreeData ======
const sortByOrder = (nodes: OrgNode[]) => [...nodes].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

const toTreeData = (nodes: OrgNode[]): DataNode[] =>
  sortByOrder(nodes).map(n => ({
    key: n.id,
    title: n.name, // ✅ 只显示名称，不再带“0.”
    children: n.children ? toTreeData(n.children) : undefined,
  }))

// ====== 组件 ======
const OrgManage: React.FC = () => {
  const [tree, setTree] = useState<OrgNode[]>([])
  const [treeLoading, setTreeLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const [detail, setDetail] = useState<OrgNode | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [form] = Form.useForm<OrgNode>()
  const [editing, setEditing] = useState(false)

  const [search, setSearch] = useState('')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addForm] = Form.useForm<{ name: string; code?: string }>()

  // 加载组织树
  const loadTree = async (keepSelection = true) => {
    setTreeLoading(true)
    try {
      const res = await OrgAPI.tree()
      setTree(res.data)
      // 如果当前选中不存在于新树，清空选择
      if (keepSelection && selectedId != null) {
        const exists = (nodes: OrgNode[], id: number): boolean =>
          nodes.some(n => n.id === id || (n.children?.length ? exists(n.children, id) : false))
        if (!exists(res.data, selectedId)) {
          setSelectedId(null)
        }
      }
    } catch (e: any) {
      message.error(e.message || '加载组织树失败')
    } finally {
      setTreeLoading(false)
    }
  }

  useEffect(() => {
    loadTree(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 加载详情
  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      form.resetFields()
      return
    }
    ;(async () => {
      setDetailLoading(true)
      try {
        const res = await OrgAPI.get(selectedId)
        const data = res.data
        setDetail(data)
        form.setFieldsValue({ ...data, is_enabled: !!data.is_enabled })
        setEditing(false)
      } catch (e: any) {
        message.error(e.message || '加载组织详情失败')
      } finally {
        setDetailLoading(false)
      }
    })()
  }, [selectedId])

  // 本地过滤树
  const filterTree = (nodes: OrgNode[], kw: string): OrgNode[] => {
    const keep: OrgNode[] = []
    for (const n of nodes) {
      const hit = n.name.toLowerCase().includes(kw.toLowerCase())
      const children = n.children ? filterTree(n.children, kw) : []
      if (hit || children.length) keep.push({ ...n, children })
    }
    return keep
  }

  const filteredTreeData = useMemo(() => {
    if (!search.trim()) return toTreeData(tree)
    return toTreeData(filterTree(tree, search.trim()))
  }, [tree, search])

  // ✅ 指定 EventDataNode<DataNode>
  const onSelect = (_: React.Key[], info: { node: EventDataNode<DataNode> }) => {
    const id = Number(info.node.key)
    if (Number.isFinite(id)) setSelectedId(id)
  }

  // 保存
  const onSave = async () => {
    try {
      const values = await form.validateFields()
      if (!detail?.id) return
      await OrgAPI.update(detail.id, {
        name: values.name?.trim(),
        code: values.code?.trim() || null,
        leader: values.leader?.trim() || null,
        phone: values.phone?.trim() || null,
        email: values.email?.trim() || null,
        address: values.address?.trim() || null,
        description: values.description?.trim() || null,
        is_enabled: !!values.is_enabled,
        sort_order: values.sort_order ?? 0,
      })
      message.success('保存成功')
      setEditing(false)
      await loadTree(true)
      const fresh = await OrgAPI.get(detail.id)
      setDetail(fresh.data)
      form.setFieldsValue({ ...fresh.data, is_enabled: !!fresh.data.is_enabled })
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e.message || '保存失败')
    }
  }

  // 删除
  const onDelete = async () => {
    if (!detail?.id) return
    try {
      await OrgAPI.remove(detail.id)
      message.success('删除成功')
      await loadTree(false)
      setSelectedId(null)
      setDetail(null)
      form.resetFields()
    } catch (e: any) {
      message.error(e.message || '删除失败')
    }
  }

  // 新增
  const openAddModal = () => {
    addForm.resetFields()
    setAddModalOpen(true)
  }

  const handleAdd = async () => {
    try {
      const values = await addForm.validateFields()
      await OrgAPI.create({
        parent_id: detail?.id ?? null,
        name: values.name.trim(),
        code: values.code?.trim() || null,
        is_enabled: true,
      })
      message.success('创建成功')
      setAddModalOpen(false)
      await loadTree(true)
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e.message || '创建失败')
    }
  }

  return (
    <Layout style={{ height: '100%', background: 'transparent' }}>
      <Sider width={320} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
        <div style={{ padding: 12 }}>
          <Space.Compact style={{ width: '100%' }}>
            <Input.Search
              allowClear
              placeholder="搜索组织..."
              onSearch={setSearch}
              onChange={e => setSearch(e.target.value)}
            />
          </Space.Compact>
          <Space style={{ marginTop: 8 }}>
            <Button icon={<ReloadOutlined />} onClick={() => loadTree(true)}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
              新增组织
            </Button>
          </Space>
        </div>

        <div style={{ padding: '0 12px 12px' }}>
          <Card size="small" styles={{ body: { padding: 0 } }}>
            <div style={{ height: 'calc(100vh - 200px)', overflow: 'auto' }}>
              <Spin spinning={treeLoading}>
                <Tree
                  showLine
                  selectedKeys={selectedId ? [String(selectedId)] : []}
                  onSelect={onSelect}
                  treeData={filteredTreeData}
                  height={700}
                />
              </Spin>
            </div>
          </Card>
        </div>
      </Sider>

      <Content style={{ padding: 16 }}>
        <Card
          title={
            <Space>
              <Title level={5} style={{ margin: 0 }}>
                组织信息
              </Title>
              {detail?.id ? <Text type="secondary">ID：{detail.id}</Text> : null}
            </Space>
          }
          extra={
            <Space>
              {!editing ? (
                <Button disabled={!detail} icon={<EditOutlined />} onClick={() => setEditing(true)}>
                  编辑
                </Button>
              ) : (
                <>
                  <Button type="primary" icon={<SaveOutlined />} onClick={onSave}>
                    保存
                  </Button>
                  <Button onClick={() => (form.resetFields(), setEditing(false))}>取消</Button>
                </>
              )}
              <Popconfirm
                title="确定要删除该组织吗？"
                okText="删除"
                okButtonProps={{ danger: true }}
                onConfirm={onDelete}
                disabled={!detail}
              >
                <Button danger icon={<DeleteOutlined />} disabled={!detail}>
                  删除
                </Button>
              </Popconfirm>
            </Space>
          }
        >
          <Form
            form={form}
            layout="vertical"
            disabled={!editing}
            preserve={false}
            initialValues={{ is_enabled: true }}
            style={{ maxWidth: 720 }}
          >
            {detailLoading ? (
              <div style={{ textAlign: 'center', padding: 48 }}>
                <Spin />
              </div>
            ) : detail ? (
              <>
                <Form.Item
                  label="组织名称"
                  name="name"
                  rules={[
                    { required: true, message: '请输入组织名称' },
                    { max: 64, message: '名称不超过64个字符' },
                  ]}
                >
                  <Input placeholder="例如：教务处 / 技术中心" />
                </Form.Item>

                <Form.Item label="组织编码" name="code" rules={[{ max: 64, message: '编码不超过64个字符' }]}>
                  <Input placeholder="可选，便于唯一识别" />
                </Form.Item>

                <Form.Item label="负责人" name="leader" rules={[{ max: 64 }]}>
                  <Input placeholder="负责人姓名" />
                </Form.Item>

                <Form.Item label="联系电话" name="phone" rules={[{ max: 32 }]}>
                  <Input placeholder="电话/手机" />
                </Form.Item>

                <Form.Item
                  label="电子邮箱"
                  name="email"
                  rules={[{ type: 'email', message: '邮箱格式不正确' }, { max: 128 }]}
                >
                  <Input placeholder="example@domain.com" />
                </Form.Item>

                <Form.Item label="地址" name="address" rules={[{ max: 128 }]}>
                  <Input placeholder="详细地址" />
                </Form.Item>

                <Form.Item label="排序号" name="sort_order">
                  <InputNumber min={0} step={1} style={{ width: '100%' }} placeholder="用于兄弟节点的显示顺序" />
                </Form.Item>

                <Form.Item label="描述" name="description" rules={[{ max: 500 }]}>
                  <Input.TextArea rows={4} placeholder="备注描述..." />
                </Form.Item>

                <Form.Item label="是否启用" name="is_enabled" valuePropName="checked">
                  <Switch disabled />
                </Form.Item>
              </>
            ) : (
              <div style={{ padding: 24, color: '#999' }}>请选择左侧组织查看详情</div>
            )}
          </Form>
        </Card>
      </Content>

      {/* 新增组织弹窗 */}
      <Modal
        title={detail ? `新增子组织（上级：${detail.name}）` : '新增根组织'}
        open={addModalOpen}
        onCancel={() => setAddModalOpen(false)}
        onOk={handleAdd}
        okText="创建"
      >
        <Form form={addForm} layout="vertical">
          <Form.Item
            label="组织名称"
            name="name"
            rules={[
              { required: true, message: '请输入组织名称' },
              { max: 64, message: '名称不超过64个字符' },
            ]}
          >
            <Input placeholder="例如：市场部 / 教学部" />
          </Form.Item>
          <Form.Item label="组织编码" name="code" rules={[{ max: 64, message: '编码不超过64个字符' }]}>
            <Input placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  )
}

export default OrgManage
