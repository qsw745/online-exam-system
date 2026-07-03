import { ApartmentOutlined, SearchOutlined } from '@ant-design/icons'
import { App, Button, Form, Input, Layout, Modal, Space, Switch, Table, Tabs, Tag, Typography } from 'antd'
import React from 'react'
import { OrgTreePanel } from '@/shared/components/OrgTreePanel'
import { useOrgTree } from '@/shared/hooks'
import { usersApi } from '@/shared/api/endpoints/users'
import GlobalPagination from '@/shared/components/GlobalPagination'
import { translate } from '@/shared/utils/i18n'

const { Sider, Content } = Layout
const { Text } = Typography

type UserRow = {
  id: number
  username?: string
  email?: string
  role?: string
  status?: 'active' | 'disabled' | string
}

function pickFirstId(tree: any[]): number | null {
  if (!Array.isArray(tree) || tree.length === 0) return null
  const first = tree.find(n => n && typeof n.id === 'number')
  return first ? first.id : null
}

export const BindUserModal: React.FC<{
  open: boolean
  targetOrgId: number
  onCancel: () => void
  /** onSubmit: emails 或 userIds 二选一 */
  onSubmit: (payload: { emails?: string[]; userIds?: number[] }) => Promise<void> | void
}> = ({ open, targetOrgId, onCancel, onSubmit }) => {
  const { message } = App.useApp()

  // =============== Tab ===============
  const [active, setActive] = React.useState<'email' | 'pick'>('email')

  // =============== 按邮箱添加 ===============
  const [form] = Form.useForm()
  const emailsValue = Form.useWatch('emails', form)
  const emailList = React.useMemo(() => {
    const list = String(emailsValue || '')
      .split(/[\s,;]+/)
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
    // 去重
    return Array.from(new Set(list))
  }, [emailsValue])

  const handleSubmitEmails = async () => {
    const { emails } = await form.validateFields()
    const list = String(emails || '')
      .split(/[\s,;]+/)
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
    if (!list.length) return message.warning(translate('auto.f550320a54'))
    await onSubmit({ emails: Array.from(new Set(list)) })
  }

  // =============== 列表选择添加 ===============
  // 左侧组织树（浏览用，不影响目标机构）
  const { tree, loading: treeLoading, refetch: refetchTree } = useOrgTree()
  const [expandedKeys, setExpandedKeys] = React.useState<React.Key[]>([])
  const [browseOrgId, setBrowseOrgId] = React.useState<number | null>(null)

  // 右侧用户列表
  const [bPage, setBPage] = React.useState(1)
  const [bLimit, setBLimit] = React.useState(10)
  const [bKeyword, setBKeyword] = React.useState('')
  const [debouncedKeyword, setDebouncedKeyword] = React.useState('')
  const [bIncludeChildren, setBIncludeChildren] = React.useState(true)
  const [bLoading, setBLoading] = React.useState(false)
  const [bRows, setBRows] = React.useState<UserRow[]>([])
  const [bTotal, setBTotal] = React.useState(0)
  const [selectedRowKeys, setSelectedRowKeys] = React.useState<React.Key[]>([])

  // 搜索防抖
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedKeyword(bKeyword), 300)
    return () => clearTimeout(t)
  }, [bKeyword])

  const fetchUsers = React.useCallback(async () => {
    setBLoading(true)
    try {
      const r: any = await usersApi.list({
        page: bPage,
        limit: bLimit,
        search: debouncedKeyword || undefined,
        orgId: browseOrgId || undefined,
        include_children: bIncludeChildren || undefined,
      })
      const payload = r?.data ?? r
      const rawList = payload?.items ?? payload?.list ?? payload?.users ?? payload?.data ?? payload ?? []
      // —— 按用户 id 去重，避免 Table 的 key 冲突 —— //
      const seen = new Set<number>()
      const list: UserRow[] = (Array.isArray(rawList) ? rawList : []).filter((row: any) => {
        const id = Number(row?.id)
        if (!id || seen.has(id)) return false
        seen.add(id)
        return true
      })
      const total = payload?.total ?? payload?.count ?? payload?.pagination?.total ?? list.length
      setBRows(list)
      setBTotal(Number(total) || 0)
    } finally {
      setBLoading(false)
    }
  }, [bPage, bLimit, debouncedKeyword, browseOrgId, bIncludeChildren])

  // —— 打开时准备数据、关闭时重置 —— //
  React.useEffect(() => {
    if (!open) return
    // 默认浏览树定位到 targetOrgId（没有则取根）
    void refetchTree().then(next => {
      const first = pickFirstId((next as any[]) || [])
      const init = targetOrgId ?? first ?? null
      setExpandedKeys(init != null ? [init] : [])
      setBrowseOrgId(init)
    })
    setActive('email')
    form.resetFields()
    setBKeyword('')
    setBPage(1)
    setBLimit(10)
    setBIncludeChildren(true)
    setSelectedRowKeys([])
  }, [open, refetchTree, targetOrgId, form])

  React.useEffect(() => {
    if (!open) return
    void fetchUsers()
  }, [open, fetchUsers])

  const handleSubmitPick = async () => {
    const ids = (selectedRowKeys as number[]) || []
    if (!ids.length) return message.warning(translate('auto.8317b899a8'))
    await onSubmit({ userIds: ids })
  }

  // ====== 提交按钮：根据当前 Tab 切换 ======
  const [submitLoading, setSubmitLoading] = React.useState(false)
  const onOk = async () => {
    try {
      setSubmitLoading(true)
      if (active === 'email') {
        await handleSubmitEmails()
      } else {
        await handleSubmitPick()
      }
    } finally {
      setSubmitLoading(false)
    }
  }

  const okText = active === 'email' ? '按邮箱绑定到机构' : `绑定到机构（${selectedRowKeys.length}）`
  const okDisabled = active === 'email' ? emailList.length === 0 : selectedRowKeys.length === 0

  const columns = [
    { title: translate('auth.username'), dataIndex: 'username' },
    { title: translate('auth.email'), dataIndex: 'email' },
    { title: translate('auth.role'), dataIndex: 'role', width: 120 },
    {
      title: translate('users.columns.status'),
      dataIndex: 'status',
      width: 100,
      render: (s: any) => <Tag color={s === 'active' ? 'green' : 'red'}>{s === 'active' ? translate('examPage.proctor.status.ok') : translate('users.status.disable')}</Tag>,
    },
  ]

  return (
    <Modal
      open={open}
      maskClosable={false}
      onCancel={onCancel}
      onOk={onOk}
      okText={okText}
      okButtonProps={{ disabled: okDisabled, loading: submitLoading }}
      cancelButtonProps={{ disabled: submitLoading }}
      title={
        <Space>
          <ApartmentOutlined />
          <Text strong>{translate('auto.6d16273ff8')}</Text>
          <Text type="secondary">{translate('auto.0d84858463')}{targetOrgId}</Text>
        </Space>
      }
      width={1000}
  
      destroyOnHidden
      styles={{ body: { padding: 0 } }}
    >
      <Tabs
        activeKey={active}
        onChange={k => setActive(k as any)}
        items={[
          {
            key: 'email',
            label: translate('auto.342eef4b5e'),
            children: (
              <div style={{ padding: 16 }}>
                <Form form={form} layout="vertical" preserve={false}>
                  <Form.Item
                    label={translate('auto.782b1a1d5b')}
                    name="emails"
                    rules={[{ required: true, message: translate('users.form.email_placeholder') }]}
                    extra={`已输入 ${emailList.length} 个邮箱`}
                  >
                    <Input.TextArea
                      placeholder="alice@example.com, bob@example.com"
                      rows={4}
                      onPressEnter={e => {
                        if (e.ctrlKey || e.metaKey) onOk()
                      }}
                    />
                  </Form.Item>
                </Form>
              </div>
            ),
          },
          {
            key: 'pick',
            label: translate('auto.91c67ac82e'),
            children: (
              <Layout style={{ height: 560 }}>
                <Sider width={280} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
                  <OrgTreePanel
                    tree={tree as any}
                    loading={treeLoading}
                    expandedKeys={expandedKeys}
                    setExpandedKeys={setExpandedKeys}
                    selectedOrgId={browseOrgId}
                    onSelect={id => {
                      setBrowseOrgId(id)
                      setBPage(1)
                      setSelectedRowKeys([])
                    }}
                    onRefresh={async () => {
                      const next = (await refetchTree()) as any[]
                      const first = pickFirstId(next || [])
                      const init = targetOrgId ?? first ?? null
                      setExpandedKeys(init != null ? [init] : [])
                      setBrowseOrgId(init)
                    }}
                    title={translate('auto.01612ca69a')}
                  />
                </Sider>
                <Content style={{ padding: 16, overflow: 'auto' }}>
                  <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
                    <Input
                      value={bKeyword}
                      onChange={e => {
                        setBKeyword(e.target.value)
                        setBPage(1)
                      }}
                      prefix={<SearchOutlined />}
                      placeholder={translate('auto.960c78b16d')}
                      allowClear
                      style={{ width: 340 }}
                    />
                    <Space>
                      <Text type="secondary">{translate('users.filters.include_children')}</Text>
                      <Switch
                        checked={bIncludeChildren}
                        onChange={v => {
                          setBIncludeChildren(v)
                          setBPage(1)
                        }}
                      />
                      <Button onClick={() => fetchUsers()}>{translate('app.refresh')}</Button>
                    </Space>
                  </Space>

                  <Table<UserRow>
                    rowKey="id"
                    loading={bLoading}
                    dataSource={bRows}
                    columns={columns as any}
                    pagination={false}
                    size="middle"
                    rowSelection={{
                      selectedRowKeys,
                      onChange: keys => setSelectedRowKeys(keys),
                      preserveSelectedRowKeys: true,
                    }}
                  />

                  <GlobalPagination
                    current={bPage}
                    pageSize={bLimit}
                    total={bTotal}
                    onChange={(p, ps) => {
                      setBPage(p)
                      setBLimit(ps)
                    }}
                  />
                </Content>
              </Layout>
            ),
          },
        ]}
      />
    </Modal>
  )
}

export default BindUserModal
