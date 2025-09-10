import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Layout, Card, Input, Table, Button, Space, Typography, message, Modal, Transfer, Tag, Empty, Spin } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { TransferDirection } from 'antd/es/transfer'
import { SearchOutlined, UserSwitchOutlined, ReloadOutlined } from '@ant-design/icons'

// ✅ 使用你项目里的 OrgTreePanel（仅导出 OrgTreePanel，没有 RoleAssignModal）
import { OrgTreePanel } from '../components/OrgTreePanel'

// ✅ 使用你项目里的 http 工具
import { api, isSuccess, getErr, type ApiResult } from '@/shared/api/http'

const { Sider, Content } = Layout
const { Text } = Typography

// —— 最小可用类型（避免外部依赖导致 TS 报错，可按需补充）——
type UserDTO = {
  id: number
  name: string
  username?: string
  orgId?: number
}

type RoleDTO = {
  id: number
  name: string
  code: string
}

type OrgNode = {
  id: number
  title: string
  key: number
  children?: OrgNode[]
}

// —— 内联的角色分配弹窗（替代从 OrgTreePanel 导出的 RoleAssignModal）——
function RoleAssignModal(props: {
  open: boolean
  user?: UserDTO | null
  allRoles: RoleDTO[]
  userRoleIds: number[]
  loading: boolean
  onCancel: () => void
  onSubmit: (nextRoleIds: number[]) => Promise<void>
}) {
  const { open, user, allRoles, userRoleIds, onCancel, onSubmit, loading } = props
  const [targetKeys, setTargetKeys] = useState<string[]>(userRoleIds.map(String))
  const [localLoading, setLocalLoading] = useState(false)

  useEffect(() => {
    setTargetKeys(userRoleIds.map(String))
  }, [userRoleIds, open])

  const dataSource = useMemo(
    () =>
      (allRoles || []).map(r => ({
        key: String(r.id),
        title: r.name,
        description: r.code,
      })),
    [allRoles]
  )

  const onChange = (nextTargetKeys: string[], _direction: TransferDirection) => {
    setTargetKeys(nextTargetKeys)
  }

  const handleOk = async () => {
    setLocalLoading(true)
    try {
      await onSubmit(targetKeys.map(k => Number(k)))
    } finally {
      setLocalLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      title={
        <Space>
          <UserSwitchOutlined />
          <span>分配角色</span>
          {user ? <Tag>{user.name}</Tag> : null}
        </Space>
      }
      onCancel={onCancel}
      onOk={handleOk}
      okButtonProps={{ loading: localLoading || loading }}
      destroyOnClose
      width={720}
    >
      <Transfer
        dataSource={dataSource}
        titles={['未分配', '已分配']}
        targetKeys={targetKeys}
        onChange={onChange}
        render={item => (
          <Space>
            <Text strong>{item.title}</Text>
            <Text type="secondary">({(item as any).description})</Text>
          </Space>
        )}
        listStyle={{ width: 300, height: 360 }}
        oneWay={false}
        showSearch
      />
    </Modal>
  )
}

const PAGE_SIZE = 10

const UserRoleManagementPage: React.FC = () => {
  // —— 左侧组织树 —— //
  const [orgTree, setOrgTree] = useState<OrgNode[]>([])
  const [orgLoading, setOrgLoading] = useState(false)
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null)

  // —— 用户列表 —— //
  const [keyword, setKeyword] = useState('')
  const [users, setUsers] = useState<UserDTO[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [listLoading, setListLoading] = useState(false)

  // —— 角色 & 分配 —— //
  const [allRoles, setAllRoles] = useState<RoleDTO[]>([])
  const [rolesLoading, setRolesLoading] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<UserDTO | null>(null)
  const [currentUserRoleIds, setCurrentUserRoleIds] = useState<number[]>([])
  const [assignSubmitting, setAssignSubmitting] = useState(false)

  // 拉组织树（与项目结构对齐：直接走 http 层）
  const fetchOrgTree = useCallback(async () => {
    setOrgLoading(true)
    try {
      const res: ApiResult<OrgNode[]> = await api.get('/orgs/tree')
      if (isSuccess(res)) {
        const nodes = (res.data || []) as OrgNode[]
        setOrgTree(nodes)
        if (nodes.length) {
          setExpandedKeys([nodes[0].id])
        }
      } else {
        message.error(res.message || '加载机构树失败')
      }
    } catch (e) {
      message.error(getErr(e))
    } finally {
      setOrgLoading(false)
    }
  }, [])

  // 拉用户列表 —— ✅ 不再使用不存在的 userService.searchAll
  const fetchUsers = useCallback(async () => {
    setListLoading(true)
    try {
      const params: any = {
        q: keyword || undefined,
        page,
        pageSize: PAGE_SIZE,
        orgId: selectedOrgId ?? undefined,
        includeChildren: true,
      }
      // 你的 users 接口位于 shared/api/endpoints/users.ts，但统一通过 http 层调用即可
      const res: ApiResult<{ rows: UserDTO[]; total: number }> = await api.get('/users', params)
      if (isSuccess(res)) {
        setUsers(res.data?.rows ?? [])
        setTotal(res.data?.total ?? 0)
      } else {
        message.error(res.message || '加载用户失败')
      }
    } catch (e) {
      message.error(getErr(e))
    } finally {
      setListLoading(false)
    }
  }, [keyword, page, selectedOrgId])

  // 拉全部角色
  const fetchAllRoles = useCallback(async () => {
    setRolesLoading(true)
    try {
      const res: ApiResult<{ rows: RoleDTO[]; total: number }> = await api.get('/roles', { page: 1, pageSize: 999 })
      if (isSuccess(res)) {
        setAllRoles(res.data?.rows ?? [])
      } else {
        message.error(res.message || '加载角色失败')
      }
    } catch (e) {
      message.error(getErr(e))
    } finally {
      setRolesLoading(false)
    }
  }, [])

  // 获取用户已有角色 —— ✅ 不再使用 rolesService.getUserRoles
  const fetchUserRoles = useCallback(async (userId: number) => {
    try {
      // 若你项目里是 /users/:id/roles 或 /roles/user/:id，按后端实际路由改一下即可
      const res: ApiResult<RoleDTO[]> = await api.get(`/users/${userId}/roles`)
      if (isSuccess(res)) {
        setCurrentUserRoleIds((res.data || []).map(r => r.id))
      } else {
        setCurrentUserRoleIds([])
        message.error(res.message || '获取用户角色失败')
      }
    } catch (e) {
      setCurrentUserRoleIds([])
      message.error(getErr(e))
    }
  }, [])

  // 提交角色变更（对比差集，逐条调用）—— ✅ 不再引用未定义的 rolesService
  const submitUserRoles = useCallback(
    async (nextRoleIds: number[]) => {
      if (!currentUser) return
      setAssignSubmitting(true)
      try {
        const before = new Set(currentUserRoleIds)
        const after = new Set(nextRoleIds)

        const toAdd: number[] = []
        const toRemove: number[] = []

        for (const id of after) if (!before.has(id)) toAdd.push(id)
        for (const id of before) if (!after.has(id)) toRemove.push(id)

        // 依次调用 add/remove
        for (const roleId of toAdd) {
          const r = await api.post(`/roles/${roleId}/members`, { userId: currentUser.id })
          if (!isSuccess(r)) throw new Error(r.message || `添加角色失败（roleId=${roleId}）`)
        }
        for (const roleId of toRemove) {
          const r = await api.delete(`/roles/${roleId}/members/${currentUser.id}`)
          if (!isSuccess(r)) throw new Error(r.message || `移除角色失败（roleId=${roleId}）`)
        }

        message.success('已更新用户角色')
        setAssignOpen(false)
        setCurrentUserRoleIds(nextRoleIds)
      } catch (e) {
        message.error(getErr(e))
      } finally {
        setAssignSubmitting(false)
      }
    },
    [currentUser, currentUserRoleIds]
  )

  // 初次加载
  useEffect(() => {
    fetchOrgTree()
    fetchAllRoles()
  }, [fetchOrgTree, fetchAllRoles])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const onRefreshUsers = () => {
    setPage(1)
    fetchUsers()
  }

  const onSelectOrg = (orgId: number) => {
    setSelectedOrgId(orgId)
    setPage(1)
  }

  const openAssign = async (u: UserDTO) => {
    setCurrentUser(u)
    setAssignOpen(true)
    await fetchUserRoles(u.id)
  }

  const columns: ColumnsType<UserDTO> = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '用户名', dataIndex: 'username', width: 160, render: (v, r) => v || r.name },
    { title: '姓名', dataIndex: 'name' },
    {
      title: '操作',
      width: 160,
      render: (_, record) => (
        <Space>
          <Button size="small" type="primary" icon={<UserSwitchOutlined />} onClick={() => openAssign(record)}>
            分配角色
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <Layout style={{ height: '100%', background: '#fff' }}>
      <Sider width={300} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
        <OrgTreePanel
          tree={orgTree as any}
          loading={orgLoading}
          expandedKeys={expandedKeys}
          setExpandedKeys={setExpandedKeys}
          selectedOrgId={selectedOrgId}
          onSelect={onSelectOrg}
          onRefresh={fetchOrgTree}
        />
      </Sider>
      <Content style={{ padding: 16 }}>
        <Card
          title="用户角色管理"
          extra={
            <Space>
              <Input
                allowClear
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onPressEnter={() => {
                  setPage(1)
                  fetchUsers()
                }}
                placeholder="搜索用户（回车执行）"
                prefix={<SearchOutlined />}
                style={{ width: 260 }}
              />
              <Button icon={<ReloadOutlined />} onClick={onRefreshUsers}>
                刷新
              </Button>
            </Space>
          }
        >
          <Table<UserDTO>
            rowKey="id"
            columns={columns}
            dataSource={users}
            loading={listLoading}
            pagination={{
              current: page,
              pageSize: PAGE_SIZE,
              total,
              onChange: p => setPage(p),
              showTotal: t => `共 ${t} 条`,
            }}
            locale={{
              emptyText: listLoading ? <Spin /> : <Empty description="暂无数据" />,
            }}
          />
        </Card>

        <RoleAssignModal
          open={assignOpen}
          user={currentUser}
          allRoles={allRoles}
          userRoleIds={currentUserRoleIds}
          loading={assignSubmitting || rolesLoading}
          onCancel={() => setAssignOpen(false)}
          onSubmit={submitUserRoles}
        />
      </Content>
    </Layout>
  )
}

export default UserRoleManagementPage
