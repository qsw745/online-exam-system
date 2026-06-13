import { useCallback, useEffect, useMemo, useState } from 'react'
import { App, Button, Drawer, Form, Input, Space, Spin, Table, Typography, Tree } from 'antd'
import type { DataNode, EventDataNode } from 'antd/es/tree'
import type { ColumnsType } from 'antd/es/table'
import { orgsApi, type OrgNode } from '@/shared/api/endpoints/orgs'
import { usersApi, type UserDTO } from '@/shared/api/endpoints/users'
import type { RecipientOption } from '@/shared/api/endpoints/mail'
import GlobalPagination from '@/shared/components/GlobalPagination'

type Props = {
  open: boolean
  selectedIds: number[]
  onSelect: (users: RecipientOption[]) => void
  onClose: () => void
}

type PageState = { page: number; limit: number; total: number }

const toTreeData = (nodes: OrgNode[]): DataNode[] =>
  nodes.map(node => ({
    key: node.id,
    title: node.name,
    children: node.children ? toTreeData(node.children) : undefined,
  }))

const toRecipient = (user: UserDTO): RecipientOption => ({
  id: user.id,
  name: user.nickname || user.name || user.username || user.email || `用户${user.id}`,
  email: user.email ?? undefined,
})

export default function OrgUserPickerDrawer({ open, selectedIds, onSelect, onClose }: Props) {
  const { message } = App.useApp()
  const [treeData, setTreeData] = useState<DataNode[]>([])
  const [treeLoading, setTreeLoading] = useState(false)
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null)
  const [users, setUsers] = useState<UserDTO[]>([])
  const [userLoading, setUserLoading] = useState(false)
  const [pager, setPager] = useState<PageState>({ page: 1, limit: 10, total: 0 })
  const [searchForm] = Form.useForm<{ keyword?: string }>()

  const loadTree = useCallback(async () => {
    setTreeLoading(true)
    try {
      const data = await orgsApi.tree()
      setTreeData(toTreeData(data))
      if (data?.[0]?.id) setSelectedOrgId(data[0].id)
    } catch (error: any) {
      message.error(error?.message || '加载组织结构失败')
    } finally {
      setTreeLoading(false)
    }
  }, [message])

  const loadUsers = useCallback(
    async (orgId: number, page = 1, keyword?: string) => {
      setUserLoading(true)
      try {
        const resp = await usersApi.list({ orgId, page, limit: pager.limit, search: keyword })
        setUsers(resp.users || [])
        setPager({ page: resp.page, limit: resp.limit, total: resp.total })
      } catch (error: any) {
        message.error(error?.message || '加载用户失败')
      } finally {
        setUserLoading(false)
      }
    },
    [message, pager.limit]
  )

  useEffect(() => {
    if (open && !treeData.length && !treeLoading) {
      loadTree()
    }
  }, [open, treeData.length, treeLoading, loadTree])

  useEffect(() => {
    if (open && selectedOrgId) {
      const keyword = searchForm.getFieldValue('keyword')
      loadUsers(selectedOrgId, 1, keyword)
    }
  }, [open, selectedOrgId, loadUsers, searchForm])

  const handleTreeSelect = (_: React.Key[], info: any) => {
    const node = info?.node as EventDataNode<DataNode>
    if (node?.key) {
      setSelectedOrgId(Number(node.key))
      searchForm.resetFields()
    }
  }

  const handleSearch = () => {
    if (!selectedOrgId) return
    const keyword = searchForm.getFieldValue('keyword')
    loadUsers(selectedOrgId, 1, keyword)
  }

  const handlePageChange = (page: number, limit?: number) => {
    if (!selectedOrgId) return
    const keyword = searchForm.getFieldValue('keyword')
    setPager(prev => ({ ...prev, page, limit: limit ?? prev.limit }))
    loadUsers(selectedOrgId, page, keyword)
  }

  const columns: ColumnsType<UserDTO> = useMemo(
    () => [
      {
        title: '姓名',
        dataIndex: 'nickname',
        render: (_: any, row) => row.nickname || row.username || row.email || `用户${row.id}`,
      },
      { title: '邮箱', dataIndex: 'email' },
      { title: '手机号', dataIndex: 'phone' },
      { title: '角色', dataIndex: 'role' },
    ],
    []
  )

  const selectedRowKeys = useMemo(() => selectedIds, [selectedIds])

  return (
    <Drawer
      title="从组织架构选择收件人"
      width={820}
      open={open}
      onClose={onClose}
      destroyOnClose
      maskClosable={false}
    >
      <Space align="start" size={16} style={{ width: '100%' }}>
        <div style={{ width: 260, maxHeight: 520, overflow: 'auto', border: '1px solid #f0f0f0', padding: 8 }}>
          <Typography.Text type="secondary">组织结构</Typography.Text>
          {treeLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin />
            </div>
          ) : (
            <Tree
              selectable
              showLine
              defaultExpandAll={false}
              treeData={treeData}
              onSelect={handleTreeSelect}
              selectedKeys={selectedOrgId ? [selectedOrgId] : []}
            />
          )}
        </div>
        <div style={{ flex: 1 }}>
          <Space style={{ marginBottom: 12 }}>
            <Form form={searchForm} layout="inline" onFinish={handleSearch}>
              <Form.Item name="keyword">
                <Input.Search placeholder="搜索姓名 / 邮箱 / 手机" allowClear onSearch={handleSearch} />
              </Form.Item>
            </Form>
          </Space>
          <Table<UserDTO>
            rowKey="id"
            size="small"
            bordered
            loading={userLoading}
            dataSource={users}
            columns={columns}
            pagination={false}
            rowSelection={{
              selectedRowKeys,
              onSelect: (record, selected) => {
                if (selected) onSelect([toRecipient(record)])
              },
              onSelectAll: (selected, selectedRows) => {
                if (selected) onSelect(selectedRows.map(toRecipient))
              },
              getCheckboxProps: record => ({
                disabled: selectedIds.includes(record.id),
              }),
            }}
          />
          <GlobalPagination
            total={pager.total}
            current={pager.page}
            pageSize={pager.limit}
            onChange={handlePageChange}
          />
        </div>
      </Space>
    </Drawer>
  )
}
