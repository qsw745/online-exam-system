import {
  ApartmentOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  FilterOutlined,
  KeyOutlined,
  MoreOutlined,
  ReloadOutlined,
  SearchOutlined,
  StarOutlined,
  StopOutlined,
  UserAddOutlined,
  UserDeleteOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { api, users } from '@shared/api/http'
import { useAuth } from '@shared/contexts/AuthContext'
import type { InputRef, TreeProps } from 'antd'
import {
  App,
  Avatar,
  Button,
  Card,
  Col,
  Divider,
  Dropdown,
  Form,
  Input,
  Layout,
  Modal,
  Pagination,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Tree,
  Typography,
} from 'antd'
import { Users as EmptyIcon } from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { OrgAPI } from '@features/orgs/api'

const { Title, Paragraph, Text } = Typography
const { Search } = Input
const { Option } = Select
const { Sider, Content } = Layout
const confirm = Modal.confirm

// ---- API 收窄工具 ----
type ApiSuccess<T> = { success: true; data: T; message?: string }
type ApiFailure = { success: false; error?: string; message?: string }
type ApiResult<T> = ApiSuccess<T> | ApiFailure
const assertSuccess = <T,>(r: ApiResult<T>): r is ApiSuccess<T> => !!r && (r as any).success === true

// 角色优先级（来自组织绑定）：admin > teacher > student
const pickDisplayRole = (codes?: string[]): 'admin' | 'teacher' | 'student' => {
  const arr = (codes || []).map(c => String(c).toLowerCase())
  if (arr.includes('admin')) return 'admin'
  if (arr.includes('teacher')) return 'teacher'
  return 'student'
}

// —— 规范状态（兼容 status / is_active） —— //
const normalizeStatus = (x: any): 'active' | 'disabled' => {
  if (typeof x.status === 'string') return x.status === 'disabled' ? 'disabled' : 'active'
  if (typeof x.is_active !== 'undefined') return Number(x.is_active) === 1 ? 'active' : 'disabled'
  return 'active'
}

interface User {
  id: number
  email: string
  role: 'student' | 'teacher' | 'admin'
  nickname?: string
  school?: string
  class_name?: string
  experience_points: number
  level: number
  status: 'active' | 'disabled'
  created_at: string
  updated_at: string
}
interface UserStatistics {
  totalSubmissions: number
  completedSubmissions: number
  averageScore: number
}
interface UserDetail extends User {
  statistics: UserStatistics
  org_id?: number | null
  org_name?: string | null
}

// —— 列表的 UI 类型（来自 /orgs/:id/users）—— //
type UIUser = {
  id: number
  email?: string
  role: 'admin' | 'teacher' | 'student'
  nickname?: string
  school?: string
  class_name?: string
  experience_points: number
  level: number
  status: 'active' | 'disabled'
  created_at?: string
  updated_at?: string
  org_id?: number | null
  org_name?: string | null
  org_path_label?: string | null
}

type RawOrgNode = { id: number; name: string; children?: RawOrgNode[] }
type OrgTreeData = {
  key: number
  title: React.ReactNode
  raw: RawOrgNode
  children?: OrgTreeData[]
}

const UserManagementPage: React.FC = () => {
  const { message } = App.useApp()
  const { user } = useAuth()
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()

  // 左侧机构树
  const [treeData, setTreeData] = useState<OrgTreeData[]>([])
  const [treeLoading, setTreeLoading] = useState(false)
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null)
  const [includeChildren, setIncludeChildren] = useState(true)

  // 右侧用户列表
  const [userList, setUserList] = useState<UIUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalUsers, setTotalUsers] = useState(0)
  const [limit, setLimit] = useState(20)

  // 详情/编辑
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingUser, setEditingUser] = useState<UIUser | null>(null)

  // 绑定用户到机构
  const [bindOpen, setBindOpen] = useState(false)
  const [bindUserIds, setBindUserIds] = useState<number[]>([])
  const [bindSearching, setBindSearching] = useState(false)
  const [bindOptions, setBindOptions] = useState<User[]>([])

  const searchInputRef = useRef<InputRef>(null)
  const isComposing = useRef(false)

  // UI：树的展开
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])
  const [orgPickerOpen, setOrgPickerOpen] = useState(false)
  const [orgPickerSelected, setOrgPickerSelected] = useState<number | null>(null)
  const [linkOrgOpen, setLinkOrgOpen] = useState(false)
  const [linkOrgIds, setLinkOrgIds] = useState<number[]>([])

  // ✅ 计算：基于 treeData.raw 构建 “id → 路径文字” 的快速映射
  const orgPathMap = useMemo(() => {
    const map = new Map<number, string>()
    const dfs = (node: RawOrgNode, trail: string[]) => {
      const nextTrail = [...trail, node.name]
      map.set(node.id, nextTrail.join(' - '))
      ;(node.children || []).forEach(ch => dfs(ch, nextTrail))
    }
    treeData.forEach(t => dfs(t.raw, []))
    return map
  }, [treeData])

  // ✅ 工具：拿路径文字
  const getOrgPathLabel = (id?: number | null, fallback?: string | null) => {
    if (!id) return fallback || null
    return orgPathMap.get(id) || fallback || null
  }

  // —— 统一映射：仅针对 /orgs/:id/users —— //
  const mapOrgItemsToUI = (items: any[]): UIUser[] =>
    (items || []).map((x: any) => {
      const org_id = x.org_id ?? null
      const org_name = x.org_name ?? null
      return {
        id: x.id,
        email: x.email ?? '',
        role: pickDisplayRole(x.role_codes),
        nickname: x.nickname ?? x.username ?? '',
        school: x.school ?? '',
        class_name: x.class_name ?? '',
        experience_points: x.experience_points ?? 0,
        level: x.level ?? 1,
        status: normalizeStatus(x),
        created_at: x.created_at,
        updated_at: x.updated_at,
        org_id,
        org_name,
        org_path_label: getOrgPathLabel(org_id, org_name),
      }
    })

  // 辅助：一次性展开全部
  const collectAllKeys = (nodes: any[] = []): React.Key[] =>
    nodes.flatMap((n: any) => [n.id, ...(n.children ? collectAllKeys(n.children) : [])])

  /** 机构树（首次默认选中根组织） */
  const fetchOrgTree = async () => {
    try {
      setTreeLoading(true)
      // ✅ 使用 OrgAPI.tree()
      const res: ApiResult<any[]> = await OrgAPI.tree()
      if (!assertSuccess(res)) {
        message.error(res.error || res.message || '加载组织树失败')
        setTreeData([])
        return
      }
      const toTree = (nodes: any[]): OrgTreeData[] =>
        (nodes || []).map((n: any) => ({
          key: n.id,
          title: n.name,
          raw: n as RawOrgNode,
          children: n.children ? toTree(n.children) : undefined,
        }))
      const t = toTree(res.data || [])
      setTreeData(t)

      if (!selectedOrgId && (res.data?.length ?? 0) > 0) setSelectedOrgId(res.data![0].id)
      setExpandedKeys(prev => (prev.length ? prev : collectAllKeys(res.data || [])))
    } catch (e: any) {
      message.error(e?.message || '加载组织树失败')
    } finally {
      setTreeLoading(false)
    }
  }

  useEffect(() => {
    fetchOrgTree()
  }, [])

  const onTreeSelect: TreeProps['onSelect'] = keys => {
    const id = Number(keys?.[0])
    if (!Number.isFinite(id)) return
    setSelectedOrgId(id)
    setCurrentPage(1)
  }

  /** ========== 用户加载：只调用 /orgs/:orgId/users ========== */
  useEffect(() => {
    loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, roleFilter, limit, selectedOrgId, includeChildren])

  // 当 treeData 变化时，回填路径
  useEffect(() => {
    if (!userList.length) return
    setUserList(prev =>
      prev.map(u => ({
        ...u,
        org_path_label: getOrgPathLabel(u.org_id, u.org_name),
      }))
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgPathMap])

  const loadUsers = async () => {
    if (!selectedOrgId) {
      setUserList([])
      setTotalUsers(0)
      return
    }
    try {
      setLoading(true)
      // ✅ 使用通用 http：GET /orgs/:id/users
      const res: ApiResult<{
        items?: any[]
        users?: any[] // 兼容某些返回
        total?: number
        page?: number
        limit?: number
      }> = await api.get(`/orgs/${selectedOrgId}/users`, {
        params: {
          page: currentPage,
          limit,
          search: searchTerm || undefined,
          role: roleFilter || undefined,
          include_children: includeChildren ? 1 : 0,
        },
      })

      if (!assertSuccess(res)) {
        message.error(res.error || res.message || '加载用户失败')
        setUserList([])
        setTotalUsers(0)
        return
      }

      const rawItems = Array.isArray(res.data?.items)
        ? res.data.items
        : Array.isArray(res.data?.users)
        ? res.data.users
        : []
      const mapped = mapOrgItemsToUI(rawItems)
      setUserList(mapped)
      setTotalUsers(Number(res.data?.total || mapped.length || 0))
    } catch (error: any) {
      console.error('加载用户列表错误:', error)
      message.error(error?.response?.data?.error || error?.message || '加载用户失败')
      setUserList([])
      setTotalUsers(0)
    } finally {
      setLoading(false)
      setTimeout(() => searchInputRef.current?.focus?.(), 0)
    }
  }

  /** ========== 详情 & 编辑 ========== */
  const openDetailFromRow = async (row: UIUser) => {
    try {
      const res: ApiResult<UserDetail> = await users.getById(row.id)
      if (!assertSuccess(res)) {
        message.error(res.error || res.message || '加载用户详情失败')
        return
      }
      const merged: UserDetail = {
        ...res.data,
        role: row.role,
        org_id: row.org_id ?? res.data.org_id,
        org_name: row.org_name ?? res.data.org_name,
      }
      setSelectedUser(merged)
      setShowDetailModal(true)
    } catch (error: any) {
      message.error(error?.response?.data?.message || '加载用户详情失败')
    }
  }

  const openEditModal = (u: UIUser) => {
    setEditingUser(u)
    editForm.setFieldsValue({
      role: u.role,
      nickname: u.nickname || '',
      school: u.school || '',
      class_name: u.class_name || '',
    })
    setShowEditModal(true)
  }

  const handleEditUser = async (values: any) => {
    if (!editingUser) return
    try {
      const res: ApiResult<any> = await api.put(`/users/${editingUser.id}`, values)
      if (!assertSuccess(res)) throw new Error(res.error || res.message || '更新失败')

      setUserList(prev => prev.map(u => (u.id === editingUser.id ? ({ ...u, ...values } as UIUser) : u)))
      message.success('用户信息更新成功')
      setShowEditModal(false)
      setEditingUser(null)
      editForm.resetFields()
      loadUsers()
    } catch (e: any) {
      message.error(e?.message || '更新失败')
    }
  }

  /** ========== 删除 / 状态 ========== */
  const handleDeleteUser = (u: UIUser) => {
    if (u.role === 'admin') {
      message.warning('管理员账号不允许删除')
      return
    }
    confirm({
      title: '确认删除用户',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除用户 "${u.nickname || u.email}" 吗？此操作不可撤销。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res: ApiResult<any> = await users.delete(u.id.toString())
          if (!assertSuccess(res)) throw new Error(res.error || '删除失败')
          message.success('用户删除成功')
          loadUsers()
        } catch (e: any) {
          message.error(e?.message || '删除失败')
        }
      },
    })
  }

  const handleToggleUserStatus = async (u: UIUser) => {
    if (u.role === 'admin' && u.status === 'active') {
      message.warning('管理员账号不允许禁用')
      return
    }
    const action = u.status === 'active' ? '禁用' : '启用'
    const newStatus = u.status === 'active' ? 'disabled' : 'active'
    confirm({
      title: `确认${action}用户`,
      icon: <ExclamationCircleOutlined />,
      content: `确定要${action}用户 "${u.nickname || u.email}" 吗？`,
      okText: `确认${action}`,
      okType: u.status === 'active' ? 'danger' : 'primary',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res: ApiResult<any> = await users.updateStatus(u.id.toString(), newStatus as any)
          if (!assertSuccess(res)) throw new Error(res.error || `${action}失败`)
          message.success(`用户${action}成功`)
          loadUsers()
        } catch (e: any) {
          message.error(e?.message || `${action}失败`)
        }
      },
    })
  }

  const handleResetPassword = (u: UIUser) => {
    confirm({
      title: '确认重置密码',
      icon: <ExclamationCircleOutlined />,
      content: `确定要重置用户 "${u.nickname || u.email}" 的密码吗？密码将重置为系统默认密码。`,
      okText: '确认重置',
      onOk: async () => {
        try {
          const res: ApiResult<any> = await users.resetPassword(u.id.toString())
          if (!assertSuccess(res)) throw new Error(res.error || '重置密码失败')
          message.success('密码重置成功')
        } catch (e: any) {
          message.error(e?.message || '重置密码失败')
        }
      },
    })
  }

  /** ========== 机构内绑定/移除用户 ========== */
  const openBindUsers = () => {
    if (!selectedOrgId) return message.warning('请先在左侧选择一个机构')
    setBindOpen(true)
    setBindOptions([])
    setBindUserIds([])
  }

  const searchBindOptions = async (keyword: string) => {
    setBindSearching(true)
    try {
      const res: ApiResult<{ users?: User[]; items?: User[] }> = await users.getAll({
        page: 1,
        limit: 30,
        search: keyword,
      } as any)
      if (!assertSuccess(res)) {
        setBindOptions([])
        return
      }
      setBindOptions((res.data?.users ?? res.data?.items ?? []) as User[])
    } finally {
      setBindSearching(false)
    }
  }

  const submitBindUsers = async () => {
    if (!selectedOrgId) return
    if (bindUserIds.length === 0) return message.warning('请选择要新增到该机构的用户')
    try {
      // ✅ 新增到机构：POST /orgs/:id/users
      const res: ApiResult<any> = await api.post(`/orgs/${selectedOrgId}/users`, { user_ids: bindUserIds })
      if (!assertSuccess(res)) throw new Error(res.error || res.message || '新增失败')
      message.success('已新增到该机构')
      setBindOpen(false)
      loadUsers()
    } catch (e: any) {
      message.error(e?.message || '新增失败')
    }
  }

  const unbindFromOrg = async (u: UIUser) => {
    if (!selectedOrgId) return
    confirm({
      title: `从机构移除 ${u.nickname || u.email}`,
      icon: <ExclamationCircleOutlined />,
      onOk: async () => {
        try {
          // ✅ 从机构移除：DELETE /orgs/:id/users/:userId
          const res: ApiResult<any> = await api.delete(`/orgs/${selectedOrgId}/users/${u.id}`)
          if (!assertSuccess(res)) throw new Error(res.error || res.message || '移除失败')
          message.success('已从机构移除')
          loadUsers()
        } catch (e: any) {
          message.error(e?.message || '移除失败')
        }
      },
    })
  }

  /** ========== 表格列 ========== */
  const getRoleTag = (role: string) => {
    const map: any = { admin: 'red', teacher: 'blue', student: 'green' }
    const label: any = { admin: '管理员', teacher: '教师', student: '学生' }
    return <Tag color={map[role] || 'default'}>{label[role] || role}</Tag>
  }

  const columns: any[] = [
    {
      title: '用户信息',
      dataIndex: 'email',
      key: 'user',
      render: (email: string, record: UIUser) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Avatar size={40} style={{ backgroundColor: '#1890ff', marginRight: 12 }} icon={<UserOutlined />}>
            {(record.nickname || email || '?').charAt(0).toUpperCase()}
          </Avatar>
          <div>
            <div style={{ fontWeight: 500 }}>{record.nickname || '未设置昵称'}</div>
            <div style={{ color: '#8c8c8c', fontSize: 12 }}>{email}</div>
          </div>
        </div>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => getRoleTag(role),
    },
    {
      title: '部门',
      dataIndex: 'org_name',
      key: 'org_path',
      render: (_: any, r: UIUser) => {
        const label = r.org_path_label || getOrgPathLabel(r.org_id, r.org_name)
        return label ? <Tag>{label}</Tag> : <Text type="secondary">未分配</Text>
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={s === 'active' ? 'green' : 'red'}>{s === 'active' ? '启用' : '禁用'}</Tag>,
    },
    {
      title: '学校/班级',
      key: 'school',
      render: (r: UIUser) => (
        <div>
          <div>{r.school || '未设置'}</div>
          <div style={{ color: '#8c8c8c', fontSize: 12 }}>{r.class_name || '未设置'}</div>
        </div>
      ),
    },
    {
      title: '等级',
      key: 'level',
      render: (r: UIUser) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Tag color="gold" icon={<StarOutlined />}>
            Lv.{r.level}
          </Tag>
          <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
            {r.experience_points} XP
          </Text>
        </div>
      ),
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (d?: string) =>
        d ? (
          <Text style={{ fontSize: 12 }}>
            {new Date(d).toLocaleDateString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (record: UIUser) => {
        const menuItems: any[] = [
          { key: 'view', icon: <EyeOutlined />, label: '查看详情', onClick: () => openDetailFromRow(record) },
          { key: 'edit', icon: <EditOutlined />, label: '编辑信息', onClick: () => openEditModal(record) },
          {
            key: 'reset-password',
            icon: <KeyOutlined />,
            label: '重置密码',
            onClick: () => handleResetPassword(record),
          },
          ...(record.role !== 'admin' || record.status === 'disabled'
            ? [
                {
                  key: 'toggle-status',
                  icon: <StopOutlined />,
                  label: record.status === 'active' ? '禁用用户' : '启用用户',
                  onClick: () => handleToggleUserStatus(record),
                },
              ]
            : []),
          { type: 'divider' },
          ...(selectedOrgId
            ? [
                {
                  key: 'unbind',
                  icon: <UserDeleteOutlined />,
                  label: '从机构移除',
                  danger: true,
                  onClick: () => unbindFromOrg(record),
                },
              ]
            : []),
          ...(record.role !== 'admin'
            ? [
                {
                  key: 'delete',
                  icon: <DeleteOutlined />,
                  label: '删除用户',
                  danger: true,
                  onClick: () => handleDeleteUser(record),
                },
              ]
            : []),
        ].filter(Boolean)

        return (
          <Space>
            <Button type="primary" ghost size="small" icon={<EyeOutlined />} onClick={() => openDetailFromRow(record)}>
              查看
            </Button>
            <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
              <Button size="small" icon={<MoreOutlined />}>
                更多
              </Button>
            </Dropdown>
          </Space>
        )
      },
    },
  ]

  return (
    <Layout style={{ padding: 16 }}>
      {/* 左侧机构树 */}
      <Sider width={300} style={{ background: '#fff', marginRight: 16, borderRight: '1px solid #f0f0f0' }}>
        <div
          style={{
            padding: 16,
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Space>
            <ApartmentOutlined />
            <Text strong>机构</Text>
          </Space>
          <Space size="small">
            <Button size="small" icon={<ReloadOutlined />} onClick={fetchOrgTree} />
          </Space>
        </div>
        <div style={{ padding: 12 }}>
          {treeLoading ? (
            <Text type="secondary">加载中...</Text>
          ) : (
            <Tree
              blockNode
              showIcon
              icon={<ApartmentOutlined />}
              selectedKeys={selectedOrgId ? [selectedOrgId] : []}
              onSelect={onTreeSelect}
              expandedKeys={expandedKeys}
              onExpand={keys => setExpandedKeys(keys as React.Key[])}
              treeData={treeData as any}
            />
          )}
        </div>
      </Sider>

      {/* 右侧内容 */}
      <Content>
        <div style={{ marginBottom: 16 }}>
          <Title level={3} style={{ margin: 0 }}>
            用户管理
          </Title>
          <Paragraph type="secondary" style={{ margin: '6px 0 0 0' }}>
            {selectedOrgId ? <>当前机构 ID：{selectedOrgId}</> : '加载机构中…'}
          </Paragraph>
        </div>

        {/* 顶部筛选 */}
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} md={12}>
              <Search
                placeholder="搜索用户邮箱或昵称..."
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value)
                  if (!isComposing.current) setTimeout(() => loadUsers(), 80)
                }}
                onCompositionStart={() => (isComposing.current = true)}
                onCompositionEnd={e => {
                  isComposing.current = false
                  setSearchTerm(e.currentTarget.value)
                  setTimeout(() => loadUsers(), 80)
                }}
                onKeyDown={e => e.key === 'Enter' && loadUsers()}
                prefix={<SearchOutlined />}
                allowClear
                size="large"
                ref={searchInputRef}
                autoFocus
              />
            </Col>
            <Col xs={24} md={12}>
              <Space wrap>
                <FilterOutlined style={{ color: '#8c8c8c' }} />
                <Select
                  value={roleFilter}
                  onChange={v => {
                    setRoleFilter(v)
                    setCurrentPage(1)
                  }}
                  style={{ width: 140 }}
                  size="large"
                  placeholder="选择角色"
                >
                  <Option value="">所有角色</Option>
                  <Option value="student">学生</Option>
                  <Option value="teacher">教师</Option>
                  <Option value="admin">管理员</Option>
                </Select>

                {selectedOrgId && (
                  <Space>
                    <Text type="secondary">含子部门</Text>
                    <Switch
                      checked={includeChildren}
                      onChange={v => {
                        setIncludeChildren(v)
                        setCurrentPage(1)
                      }}
                    />
                  </Space>
                )}

                <Button type="primary" icon={<UserAddOutlined />} disabled={!selectedOrgId} onClick={openBindUsers}>
                  新增用户到该机构
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* 列表 */}
        <Card>
          <Table<UIUser>
            columns={columns as any}
            dataSource={userList}
            rowKey="id"
            loading={loading}
            pagination={false}
            locale={{
              emptyText: (
                <div style={{ padding: 40, textAlign: 'center' }}>
                  <EmptyIcon size={48} style={{ color: '#d9d9d9', marginBottom: 16 }} />
                  <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>暂无用户数据</div>
                  {(searchTerm || roleFilter) && (
                    <div style={{ color: '#8c8c8c' }}>
                      尝试使用其他搜索条件或
                      <Button
                        type="link"
                        size="small"
                        onClick={() => {
                          setSearchTerm('')
                          setRoleFilter('')
                          setCurrentPage(1)
                        }}
                      >
                        清除筛选
                      </Button>
                    </div>
                  )}
                </div>
              ),
            }}
          />

          {/* 分页 */}
          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <Pagination
              current={currentPage}
              total={totalUsers}
              pageSize={limit}
              showSizeChanger
              showQuickJumper
              showTotal={(total, range) => `${range[0]}-${range[1]} / 共 ${total} 条`}
              pageSizeOptions={['10', '20', '50', '100']}
              onChange={page => setCurrentPage(page)}
              onShowSizeChange={(_cur, size) => {
                setLimit(size)
                setCurrentPage(1)
              }}
            />
          </div>
        </Card>
      </Content>

      {/* 用户详情 */}
      <Modal
        title="用户详情"
        open={showDetailModal}
        onCancel={() => setShowDetailModal(false)}
        footer={[
          <Button
            key="edit"
            onClick={() => {
              setShowDetailModal(false)
              if (selectedUser)
                openEditModal({
                  id: selectedUser.id,
                  email: selectedUser.email,
                  role: selectedUser.role,
                  nickname: selectedUser.nickname,
                  school: selectedUser.school,
                  class_name: selectedUser.class_name,
                  experience_points: selectedUser.experience_points,
                  level: selectedUser.level,
                  status: selectedUser.status,
                  created_at: selectedUser.created_at,
                  updated_at: selectedUser.updated_at,
                  org_id: selectedUser.org_id,
                  org_name: selectedUser.org_name ?? undefined,
                  org_path_label: getOrgPathLabel(selectedUser.org_id, selectedUser.org_name ?? undefined) ?? undefined,
                })
            }}
          >
            编辑用户
          </Button>,
          <Button key="close" type="primary" onClick={() => setShowDetailModal(false)}>
            关闭
          </Button>,
        ]}
        width={800}
        style={{ top: 20 }}
        destroyOnHidden
      >
        {selectedUser && (
          <div>
            <Title level={4}>基本信息</Title>
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col span={12}>
                <Card size="small">
                  <Text type="secondary">邮箱</Text>
                  <div>{selectedUser.email}</div>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small">
                  <Text type="secondary">昵称</Text>
                  <div>{selectedUser.nickname || '未设置'}</div>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small">
                  <Text type="secondary">角色</Text>
                  <div>{getRoleTag(selectedUser.role)}</div>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small">
                  <Text type="secondary">状态</Text>
                  <div>
                    <Tag color={selectedUser.status === 'active' ? 'green' : 'red'}>
                      {selectedUser.status === 'active' ? '启用' : '禁用'}
                    </Tag>
                  </div>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small">
                  <Text type="secondary">注册时间</Text>
                  <div>{new Date(selectedUser.created_at).toLocaleString()}</div>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small">
                  <Text type="secondary">所属部门</Text>
                  <div>
                    {(() => {
                      const label = getOrgPathLabel(selectedUser.org_id, selectedUser.org_name ?? undefined)
                      return label ? <Tag>{label}</Tag> : <Text type="secondary">未分配</Text>
                    })()}
                  </div>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small">
                  <Text type="secondary">学校</Text>
                  <div>{selectedUser.school || '未设置'}</div>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small">
                  <Text type="secondary">班级</Text>
                  <div>{selectedUser.class_name || '未设置'}</div>
                </Card>
              </Col>
            </Row>
            <Divider />
            <Title level={4}>学习统计</Title>
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <Card>
                  <Statistic title="等级" value={selectedUser.level} />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic title="经验值" value={selectedUser.experience_points} suffix="XP" />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic title="平均分数" value={selectedUser.statistics.averageScore} precision={1} />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic title="总提交次数" value={selectedUser.statistics.totalSubmissions} />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic title="完成次数" value={selectedUser.statistics.completedSubmissions} />
                </Card>
              </Col>
            </Row>
          </div>
        )}
      </Modal>

      {/* 编辑用户 */}
      <Modal
        title={
          <span>
            <EditOutlined style={{ marginRight: 8 }} />
            编辑用户
          </span>
        }
        open={showEditModal}
        onCancel={() => {
          setShowEditModal(false)
          setEditingUser(null)
          editForm.resetFields()
        }}
        footer={null}
        width={600}
        destroyOnHidden
      >
        {editingUser && (
          <Form
            form={editForm}
            layout="vertical"
            onFinish={handleEditUser}
            initialValues={{
              role: editingUser.role,
              nickname: editingUser.nickname,
              school: editingUser.school,
              class_name: editingUser.class_name,
            }}
          >
            <Form.Item label="角色" name="role" rules={[{ required: true, message: '请选择用户角色' }]}>
              <Select placeholder="选择用户的系统角色">
                <Option value="student">学生</Option>
                <Option value="teacher">教师</Option>
                <Option value="admin">管理员</Option>
              </Select>
            </Form.Item>

            {/* 显示当前完整路径 */}
            <Form.Item label="所属机构">
              <Space>
                <Input
                  value={getOrgPathLabel(editingUser.org_id, editingUser.org_name ?? undefined) || '未分配'}
                  readOnly
                  style={{ width: 320 }}
                />
                <Button
                  onClick={() => {
                    setOrgPickerSelected(editingUser?.org_id ?? selectedOrgId ?? null)
                    setOrgPickerOpen(true)
                  }}
                >
                  修改
                </Button>
              </Space>
            </Form.Item>

            <Form.Item label="更多部门">
              <Button
                onClick={() => {
                  setLinkOrgIds([])
                  setLinkOrgOpen(true)
                }}
              >
                关联多个部门
              </Button>
              <Text type="secondary" style={{ marginLeft: 8 }}>
                不会移除现有关联，可选主部门。
              </Text>
            </Form.Item>

            <Form.Item
              label="昵称"
              name="nickname"
              rules={[
                { required: true, message: '昵称不能为空' },
                { max: 20, message: '昵称不能超过20个字符' },
              ]}
            >
              <Input placeholder="用户在系统中显示的名称" />
            </Form.Item>
            <Form.Item label="学校" name="school">
              <Input placeholder="用户所属的学校名称" />
            </Form.Item>
            <Form.Item label="班级" name="class_name">
              <Input placeholder="用户所属的班级名称" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingUser(null)
                    editForm.resetFields()
                  }}
                >
                  取消
                </Button>
                <Button type="primary" htmlType="submit" icon={<UserOutlined />}>
                  保存更改
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* 新增用户到机构 */}
      <Modal
        title="新增用户到当前机构"
        open={bindOpen}
        onCancel={() => setBindOpen(false)}
        onOk={submitBindUsers}
        okText="确认新增"
        destroyOnHidden
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Select
            mode="multiple"
            allowClear
            placeholder="搜索并选择用户（邮箱/昵称）"
            value={bindUserIds}
            onChange={ids => setBindUserIds(ids as number[])}
            showSearch
            onSearch={searchBindOptions}
            filterOption={false}
            loading={bindSearching}
            style={{ width: '100%' }}
          >
            {bindOptions.map(u => (
              <Option key={u.id} value={u.id}>
                {u.nickname || u.email}（{u.email}）
              </Option>
            ))}
          </Select>
          <Text type="secondary">提示：支持多选。若需创建新账号，请到“用户新增”入口后再关联。</Text>
        </Space>
      </Modal>

      {/* 选择所属机构（变更主机构） */}
      <Modal
        title="选择所属机构"
        open={orgPickerOpen}
        onCancel={() => setOrgPickerOpen(false)}
        onOk={async () => {
          if (!editingUser || !orgPickerSelected) {
            setOrgPickerOpen(false)
            return
          }
          try {
            // ✅ 若已有来源机构：先加入目标，再从来源删除；否则直接加入目标
            if (editingUser.org_id && editingUser.org_id !== orgPickerSelected) {
              const addRes: ApiResult<any> = await api.post(`/orgs/${orgPickerSelected}/users`, {
                user_ids: [editingUser.id],
              })
              if (!assertSuccess(addRes)) throw new Error(addRes.error || addRes.message || '加入目标机构失败')

              const delRes: ApiResult<any> = await api.delete(`/orgs/${editingUser.org_id}/users/${editingUser.id}`)
              if (!assertSuccess(delRes)) throw new Error(delRes.error || delRes.message || '从来源机构移除失败')
            } else if (!editingUser.org_id) {
              const addRes: ApiResult<any> = await api.post(`/orgs/${orgPickerSelected}/users`, {
                user_ids: [editingUser.id],
              })
              if (!assertSuccess(addRes)) throw new Error(addRes.error || addRes.message || '加入机构失败')
            }

            message.success('已更新所属机构')
            setOrgPickerOpen(false)
            await loadUsers()

            // 同步编辑状态与详情
            const newLabel = getOrgPathLabel(orgPickerSelected) || ''
            editForm.setFieldValue('org_name', newLabel)
            setEditingUser(prev =>
              prev
                ? {
                    ...prev,
                    org_id: orgPickerSelected,
                    org_name: undefined,
                    org_path_label: newLabel,
                  }
                : prev
            )
            if (selectedUser?.id === editingUser.id) {
              setSelectedUser(prev => (prev ? { ...prev, org_id: orgPickerSelected, org_name: undefined } : prev))
            }
          } catch (e: any) {
            message.error(e?.message || '更新失败')
          }
        }}
        okText="确定"
        destroyOnHidden
      >
        <div style={{ maxHeight: 480, overflow: 'auto', padding: 8, border: '1px solid #f0f0f0', borderRadius: 8 }}>
          {treeLoading ? (
            <Text type="secondary">加载中...</Text>
          ) : (
            <Tree
              blockNode
              showIcon
              defaultExpandAll
              icon={<ApartmentOutlined />}
              selectedKeys={orgPickerSelected ? [orgPickerSelected] : []}
              onSelect={keys => setOrgPickerSelected(Number(keys?.[0]) || null)}
              treeData={treeData as any}
            />
          )}
        </div>
      </Modal>

      {/* 关联多个部门 */}
      <Modal
        title="关联多个部门"
        open={linkOrgOpen}
        onCancel={() => setLinkOrgOpen(false)}
        onOk={async () => {
          if (!editingUser) {
            setLinkOrgOpen(false)
            return
          }
          if (linkOrgIds.length === 0) {
            message.warning('请至少选择一个部门')
            return
          }
          try {
            // ✅ 关联多个机构：POST /users/:userId/orgs
            const res: ApiResult<any> = await api.post(`/users/${editingUser.id}/orgs`, { org_ids: linkOrgIds })
            if (!assertSuccess(res)) throw new Error(res.error || res.message || '关联失败')
            message.success('关联成功')
            setLinkOrgOpen(false)
            await loadUsers()
            if (selectedUser?.id === editingUser.id) await openDetailFromRow(editingUser)
          } catch (e: any) {
            message.error(e?.message || '关联失败')
          }
        }}
        okText="确定"
        destroyOnHidden
      >
        <div style={{ maxHeight: 480, overflow: 'auto', padding: 8, border: '1px solid #f0f0f0', borderRadius: 8 }}>
          {treeLoading ? (
            <Text type="secondary">加载中...</Text>
          ) : (
            <Tree
              checkable
              defaultExpandAll
              blockNode
              showIcon
              icon={<ApartmentOutlined />}
              onCheck={keys => setLinkOrgIds((keys as React.Key[]).map(k => Number(k)).filter(Boolean))}
              treeData={treeData as any}
            />
          )}
        </div>
      </Modal>
    </Layout>
  )
}

export default UserManagementPage
