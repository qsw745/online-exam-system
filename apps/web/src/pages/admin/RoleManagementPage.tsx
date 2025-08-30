// apps/web/src/pages/admin/RoleManagementPage.tsx
import {
  DeleteOutlined,
  EditOutlined,
  MoreOutlined,
  PlusOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Dropdown,
  Form,
  Input,
  InputNumber,
  MenuProps,
  Modal,
  Pagination,
  Row,
  Space,
  Switch,
  Table,
  Tag,
  Tree,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { DataNode } from 'antd/es/tree'
import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { api } from '../../lib/api'

// ========= 统一的 ApiResult 类型守卫 =========
type ApiSuccess<T = any> = {
  success: true
  data: T
  message?: string
  total?: number
  page?: number
  pageSize?: number
}
type ApiFailure = { success: false; message?: string; error?: string }
type ApiResult<T = any> = ApiSuccess<T> | ApiFailure

const isSuccess = <T,>(r: any): r is ApiSuccess<T> => r && typeof r === 'object' && r.success === true
const isFailure = (r: any): r is ApiFailure => r && typeof r === 'object' && r.success === false
// ============================================

interface Role {
  id: number
  name: string
  code: string
  description: string
  is_system: boolean
  is_disabled: boolean
  created_at: string
  updated_at: string
}

interface MenuItem {
  id: number
  name: string
  title: string
  path?: string
  icon?: string
  parent_id?: number
  children?: MenuItem[]
}

// 关键修复：用于构建树的节点类型（children 必选）
type MenuNode = Omit<MenuItem, 'children'> & { children: MenuNode[] }

interface RoleUser {
  id: number
  username: string
  email: string
  assigned_at: string
}

interface User {
  id: number
  username: string
  email: string
  status: string
  created_at: string
}

const RoleManagementPage: React.FC = () => {
  const { message, modal } = App.useApp()
  const { user } = useAuth()

  const [roles, setRoles] = useState<Role[]>([])
  const [menus, setMenus] = useState<MenuItem[]>([])

  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [permissionModalVisible, setPermissionModalVisible] = useState(false)

  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)

  const [selectedMenuIds, setSelectedMenuIds] = useState<number[]>([])
  const [nextSortOrder, setNextSortOrder] = useState<number>(1)

  const [form] = Form.useForm()

  // 成员管理
  const [memberModalVisible, setMemberModalVisible] = useState(false)
  const [roleUsers, setRoleUsers] = useState<RoleUser[]>([])
  const [memberLoading, setMemberLoading] = useState(false)

  // 选择用户
  const [userSelectModalVisible, setUserSelectModalVisible] = useState(false)
  const [availableUsers, setAvailableUsers] = useState<User[]>([])
  const [userSelectLoading, setUserSelectLoading] = useState(false)
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([])

  // 分页 & 搜索
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [searchKeyword, setSearchKeyword] = useState('')

  // ====== 数据加载 ======
  const loadRoles = async (page = currentPage, size = pageSize, keyword = searchKeyword) => {
    try {
      setLoading(true)
      const params = { page, pageSize: size, ...(keyword && { keyword }) }
      const resp: ApiResult<any> = await api.get('/roles', { params })

      if (isSuccess(resp)) {
        const d = resp.data as any
        if (Array.isArray(d)) {
          setRoles(d)
          setTotal(d.length)
        } else if (d?.roles) {
          setRoles(d.roles)
          setTotal(d.total ?? d.roles.length ?? 0)
        } else {
          setRoles(d ?? [])
          setTotal(d?.length ?? 0)
        }
        setCurrentPage(page)
        setPageSize(size)
      } else if (isFailure(resp)) {
        message.error(resp.message || '加载角色列表失败')
      } else {
        message.error('加载角色列表失败')
      }
    } catch (err) {
      console.error('加载角色列表失败:', err)
      message.error('加载角色列表失败')
    } finally {
      setLoading(false)
    }
  }

  const loadMenus = async () => {
    try {
      const resp: ApiResult<any> = await api.get('/menu/menus')
      if (isSuccess<any>(resp)) {
        const d = resp.data
        setMenus(Array.isArray(d) ? d : d?.menus ?? d ?? [])
      } else if (Array.isArray(resp as any)) {
        setMenus(resp as any)
      } else {
        message.error((resp as any)?.message || '加载菜单失败')
      }
    } catch (e) {
      console.error('加载菜单失败:', e)
      message.error('加载菜单失败')
    }
  }

  const loadRoleMenus = async (roleId: number) => {
    try {
      const resp: ApiResult<MenuItem[]> = await api.get(`/roles/${roleId}/menus`)
      if (isSuccess(resp)) {
        setSelectedMenuIds((resp.data || []).map(m => m.id))
      } else {
        message.error(resp.message || '加载角色权限失败')
      }
    } catch (e) {
      console.error('加载角色权限失败:', e)
      message.error('加载角色权限失败')
    }
  }

  useEffect(() => {
    loadRoles()
    loadMenus()
  }, [])

  // ====== 搜索 / 分页 ======
  const onSearch = (v: string) => {
    setSearchKeyword(v)
    loadRoles(1, pageSize, v)
  }
  const onResetSearch = () => {
    setSearchKeyword('')
    loadRoles(1, pageSize, '')
  }
  const onPageChange = (page: number, size?: number) => {
    loadRoles(page, size ?? pageSize, searchKeyword)
  }

  // ====== 菜单树（关键修复：使用 MenuNode） ======
  const treeData: DataNode[] = useMemo(() => {
    const map = new Map<number, MenuNode>()
    const roots: MenuNode[] = []

    menus.forEach(m => map.set(m.id, { ...m, children: [] }))
    menus.forEach(m => {
      const me = map.get(m.id)!
      if (m.parent_id && map.has(m.parent_id)) {
        map.get(m.parent_id)!.children.push(me)
      } else {
        roots.push(me)
      }
    })

    const toTree = (items: MenuNode[]): DataNode[] =>
      items.map(it => ({
        key: it.id,
        title: it.title,
        children: it.children.length ? toTree(it.children) : undefined,
      }))

    return toTree(roots)
  }, [menus])

  // ====== 表单提交 ======
  const handleSubmit = async (values: any) => {
    try {
      if (editingRole) {
        const resp: ApiResult<any> = await api.put(`/roles/${editingRole.id}`, values)
        if (isSuccess(resp)) {
          message.success('角色更新成功')
          loadRoles()
        } else {
          message.error(resp.message || '角色更新失败')
        }
      } else {
        const resp: ApiResult<any> = await api.post('/roles', values)
        if (isSuccess(resp)) {
          message.success('角色创建成功')
          loadRoles()
        } else {
          message.error(resp.message || '角色创建失败')
        }
      }
      setModalVisible(false)
      setEditingRole(null)
      form.resetFields()
    } catch (e) {
      console.error(e)
      message.error('操作失败')
    }
  }

  const handleDelete = async (role: Role) => {
    try {
      const resp: ApiResult<any> = await api.delete(`/roles/${role.id}`)
      if (isSuccess(resp)) {
        message.success('角色删除成功')
        loadRoles()
      } else {
        message.error(resp.message || '删除失败')
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message || '删除失败')
    }
  }

  const handleSavePermissions = async () => {
    if (!selectedRole) return
    try {
      const resp: ApiResult<any> = await api.put(`/roles/${selectedRole.id}/menus`, { menuIds: selectedMenuIds })
      if (isSuccess(resp)) {
        message.success('权限设置成功')
        setPermissionModalVisible(false)
      } else {
        message.error(resp.message || '权限设置失败')
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message || '权限设置失败')
    }
  }

  const openPermissionModal = async (role: Role) => {
    setSelectedRole(role)
    await loadRoleMenus(role.id)
    setPermissionModalVisible(true)
  }

  // ====== 成员相关 ======
  const loadRoleUsers = async (roleId: number) => {
    try {
      setMemberLoading(true)
      const resp: ApiResult<RoleUser[]> = await api.get(`/roles/${roleId}/users`)
      if (isSuccess(resp)) {
        setRoleUsers(resp.data || [])
      } else {
        message.error(resp.message || '加载角色用户列表失败')
      }
    } catch (e: any) {
      console.error('加载角色用户列表失败:', e)
      message.error(e?.response?.data?.message || '加载角色用户列表失败')
    } finally {
      setMemberLoading(false)
    }
  }

  const openMemberModal = async (role: Role) => {
    setSelectedRole(role)
    await loadRoleUsers(role.id)
    setMemberModalVisible(true)
  }

  // 关键修复：不要直接 allUsers.data.users（data 是 unknown）
  const loadAvailableUsers = async (roleId: number) => {
    try {
      setUserSelectLoading(true)
      const allUsers: ApiResult<any> = await api.get('/users')
      if (!isSuccess(allUsers)) {
        message.error(allUsers.message || '加载用户列表失败')
        return
      }
      // 先把 data 存到局部变量，统一判型
      const allUsersData: any = allUsers.data

      const roleUsersResp: ApiResult<RoleUser[]> = await api.get(`/roles/${roleId}/users`)
      const currentRoleUserIds = isSuccess(roleUsersResp) ? (roleUsersResp.data || []).map(u => u.id) : []

      let usersArray: User[] = []
      if (Array.isArray(allUsersData?.users)) {
        usersArray = allUsersData.users as User[]
      } else if (Array.isArray(allUsersData)) {
        usersArray = allUsersData as User[]
      } else if (Array.isArray(allUsersData?.data)) {
        usersArray = allUsersData.data as User[]
      }

      const canAdd = usersArray.filter(u => !currentRoleUserIds.includes(u.id) && u.status === 'active')
      setAvailableUsers(canAdd)
    } catch (e) {
      console.error('加载用户列表失败:', e)
      message.error('加载用户列表失败')
    } finally {
      setUserSelectLoading(false)
    }
  }

  const openUserSelectModal = async () => {
    if (!selectedRole) return
    setSelectedUserIds([])
    await loadAvailableUsers(selectedRole.id)
    setUserSelectModalVisible(true)
  }

  const addUsersToRole = async () => {
    if (!selectedRole || selectedUserIds.length === 0) {
      message.warning('请选择要添加的用户')
      return
    }
    try {
      setUserSelectLoading(true)
      const resp: ApiResult<any> = await api.post(`/roles/${selectedRole.id}/users`, { userIds: selectedUserIds })
      if (isSuccess(resp)) {
        message.success(`成功添加 ${selectedUserIds.length} 个用户到角色`)
        setUserSelectModalVisible(false)
        setSelectedUserIds([])
        await loadRoleUsers(selectedRole.id)
      } else {
        message.error(resp.message || '添加用户失败')
      }
    } catch (e: any) {
      console.error('添加用户到角色失败:', e)
      message.error(e?.response?.data?.message || '添加用户失败')
    } finally {
      setUserSelectLoading(false)
    }
  }

  // —— 修复：移除后红色提示、列表不更新 —— //
  const removeUserFromRole = async (roleId: number, userId: number) => {
    try {
      setMemberLoading(true)
      const resp: ApiResult<any> = await api.delete(`/roles/${roleId}/users/${userId}`)
      if (isSuccess(resp)) {
        // 先本地乐观更新
        setRoleUsers(prev => prev.filter(u => u.id !== userId))
        message.success('已从角色中移除该用户')
        // 再拉取一次，保证一致
        await loadRoleUsers(roleId)
        await loadAvailableUsers(roleId)
      } else {
        message.error(resp.message || '移除用户失败')
      }
    } catch (e: any) {
      console.error('移除用户失败:', e)
      message.error(e?.response?.data?.message || '移除用户失败')
    } finally {
      setMemberLoading(false)
    }
  }

  // 生成编码
  const generateRoleCode = () => {
    const roleName = form.getFieldValue('name')
    if (!roleName || roleName.trim() === '') {
      message.warning('请先输入角色名称')
      return
    }
    let code = roleName
      .toLowerCase()
      .replace(/[\s\u4e00-\u9fa5]+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
    if (!code) code = 'role'
    form.setFieldsValue({ code })
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    if (!editingRole && name && !form.getFieldValue('code')) {
      const code = name
        .toLowerCase()
        .replace(/[\s\u4e00-\u9fa5]+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
      if (code) form.setFieldsValue({ code })
    }
  }

  // 列
  const columns: ColumnsType<Role> = [
    {
      title: '角色名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          {text}
          {record.is_system && <Tag color="blue">系统角色</Tag>}
          {record.is_disabled && <Tag color="red">已禁用</Tag>}
        </Space>
      ),
    },
    { title: '角色编码', dataIndex: 'code', key: 'code' },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', render: t => new Date(t).toLocaleString() },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => {
        const menuItems: MenuProps['items'] = [
          {
            key: 'edit',
            icon: <EditOutlined />,
            label: '编辑',
            onClick: () => {
              setEditingRole(record)
              form.setFieldsValue(record)
              setModalVisible(true)
            },
          },
          {
            key: 'permission',
            icon: <SettingOutlined />,
            label: '权限设置',
            onClick: () => openPermissionModal(record),
          },
          { key: 'members', icon: <TeamOutlined />, label: '成员管理', onClick: () => openMemberModal(record) },
        ]
        if (!record.is_system) {
          menuItems.push({
            key: 'delete',
            icon: <DeleteOutlined />,
            label: '删除',
            danger: true,
            onClick: () =>
              Modal.confirm({
                title: '确定要删除这个角色吗？',
                content: '删除后将无法恢复',
                okText: '确定',
                cancelText: '取消',
                onOk: () => handleDelete(record),
              }),
          })
        }
        return (
          <Space size={0}>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setEditingRole(record)
                form.setFieldsValue(record)
                setModalVisible(true)
              }}
            />
            <Dropdown menu={{ items: menuItems }} trigger={['hover', 'click']} placement="bottomRight">
              <Button type="link" size="small" icon={<MoreOutlined />} onClick={e => e.preventDefault()} />
            </Dropdown>
          </Space>
        )
      },
    },
  ]

  return (
    <div className="p-6">
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">角色管理</h2>
          <div className="flex items-center space-x-4">
            <Input.Search
              placeholder="搜索角色名称或编码"
              allowClear
              style={{ width: 300 }}
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              onSearch={onSearch}
              onClear={onResetSearch as any}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={async () => {
                setEditingRole(null)
                form.resetFields()
                try {
                  if (!user?.id) {
                    message.error('请先登录')
                    setNextSortOrder(1)
                    form.setFieldsValue({ sort_order: 1 })
                    return
                  }
                  const resp: ApiResult<number> = await api.get('/roles/next-sort-order')
                  if (isSuccess(resp)) {
                    setNextSortOrder(resp.data as number)
                    form.setFieldsValue({ sort_order: resp.data })
                  } else {
                    setNextSortOrder(1)
                    form.setFieldsValue({ sort_order: 1 })
                  }
                } catch {
                  setNextSortOrder(1)
                  form.setFieldsValue({ sort_order: 1 })
                }
                setModalVisible(true)
              }}
            >
              新建角色
            </Button>
          </div>
        </div>

        <Table columns={columns} dataSource={roles} rowKey="id" loading={loading} pagination={false} />

        <div className="mt-4">
          <Pagination
            current={currentPage}
            total={total}
            pageSize={pageSize}
            showSizeChanger
            showQuickJumper
            onChange={onPageChange}
            onShowSizeChange={(_, size) => onPageChange(1, size)}
            showTotal={(t, range) => `共 ${t} 条，当前 ${range[0]}-${range[1]}`}
          />
        </div>
      </Card>

      {/* 角色编辑 */}
      <Modal
        title={editingRole ? '编辑角色' : '新建角色'}
        open={modalVisible}
        onOk={() => form.submit()}
        onCancel={() => {
          setModalVisible(false)
          setEditingRole(null)
          form.resetFields()
        }}
        width={600}
        destroyOnHidden
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="角色名称"
                name="name"
                rules={[
                  { required: true, message: '请输入角色名称' },
                  { max: 50, message: '角色名称不能超过50个字符' },
                ]}
              >
                <Input placeholder="请输入角色名称" disabled={editingRole?.is_system} onChange={handleNameChange} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="角色编码"
                name="code"
                rules={[
                  { required: true, message: '请输入角色编码' },
                  { max: 50, message: '角色编码不能超过50个字符' },
                  { pattern: /^[a-zA-Z0-9_]+$/, message: '角色编码只能包含字母、数字和下划线' },
                ]}
              >
                <Input
                  placeholder="请输入角色编码（留空自动生成）"
                  disabled={editingRole?.is_system}
                  suffix={
                    !editingRole && (
                      <Button
                        type="link"
                        size="small"
                        onClick={generateRoleCode}
                        style={{ padding: 0, height: 'auto' }}
                      >
                        自动生成
                      </Button>
                    )
                  }
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="角色描述" name="description" rules={[{ max: 500, message: '角色描述不能超过500个字符' }]}>
            <Input.TextArea placeholder="请输入角色描述" rows={3} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="排序号"
                name="sort_order"
                rules={[
                  { required: true, message: '请输入排序号' },
                  { type: 'number', min: 1, message: '排序号必须大于0' },
                ]}
              >
                <InputNumber placeholder="请输入排序号" min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="状态" name="is_disabled" valuePropName="checked">
                <Switch checkedChildren="禁用" unCheckedChildren="启用" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* 权限设置 */}
      <Modal
        title={`设置角色权限 - ${selectedRole?.name ?? ''}`}
        open={permissionModalVisible}
        onOk={handleSavePermissions}
        onCancel={() => setPermissionModalVisible(false)}
        width={800}
        okText="保存"
        cancelText="取消"
      >
        {selectedRole && (
          <>
            <Descriptions size="small" column={2} className="mb-4">
              <Descriptions.Item label="角色名称">{selectedRole.name}</Descriptions.Item>
              <Descriptions.Item label="角色编码">{selectedRole.code}</Descriptions.Item>
              <Descriptions.Item label="角色描述" span={2}>
                {selectedRole.description || '无描述'}
              </Descriptions.Item>
            </Descriptions>

            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-medium">菜单权限</h3>
                <Button size="small" onClick={loadMenus}>
                  刷新菜单
                </Button>
              </div>

              {menus.length === 0 ? (
                <div className="text-center py-8 text-gray-500">暂无菜单数据，请检查菜单配置</div>
              ) : (
                <Tree
                  checkable
                  checkedKeys={selectedMenuIds}
                  onCheck={checked => setSelectedMenuIds(checked as number[])}
                  treeData={treeData}
                  height={400}
                  defaultExpandAll
                />
              )}
            </div>
          </>
        )}
      </Modal>

      {/* 成员管理 */}
      <Modal
        title={`成员管理 - ${selectedRole?.name ?? ''}`}
        open={memberModalVisible}
        onCancel={() => setMemberModalVisible(false)}
        width={800}
        footer={[
          <Button key="close" onClick={() => setMemberModalVisible(false)}>
            关闭
          </Button>,
        ]}
      >
        {selectedRole && (
          <>
            <Descriptions size="small" column={2} className="mb-4">
              <Descriptions.Item label="角色名称">{selectedRole.name}</Descriptions.Item>
              <Descriptions.Item label="角色编码">{selectedRole.code}</Descriptions.Item>
              <Descriptions.Item label="角色描述" span={2}>
                {selectedRole.description || '无描述'}
              </Descriptions.Item>
            </Descriptions>

            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-medium">角色成员</h3>
                <Button type="primary" icon={<PlusOutlined />} onClick={openUserSelectModal}>
                  添加成员
                </Button>
              </div>

              {memberLoading ? (
                <div className="text-center py-8">加载中...</div>
              ) : roleUsers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">该角色暂无成员</div>
              ) : (
                <Table
                  dataSource={roleUsers}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  columns={[
                    {
                      title: '用户',
                      key: 'user',
                      render: (_, record) => (
                        <Space>
                          <UserOutlined />
                          <div>
                            <div className="font-medium">{record.username}</div>
                            <div className="text-gray-500 text-sm">{record.email}</div>
                          </div>
                        </Space>
                      ),
                    },
                    {
                      title: '分配时间',
                      dataIndex: 'assigned_at',
                      key: 'assigned_at',
                      render: text => new Date(text).toLocaleString(),
                    },
                    {
                      title: '操作',
                      key: 'action',
                      render: (_, record) => (
                        <Button
                          type="link"
                          danger
                          size="small"
                          onClick={() =>
                            modal.confirm({
                              title: '确定要移除该用户吗？',
                              content: `将从角色"${selectedRole!.name}"中移除用户"${record.username}"`,
                              okText: '确定',
                              cancelText: '取消',
                              onOk: () => removeUserFromRole(selectedRole!.id, record.id),
                            })
                          }
                        >
                          移除
                        </Button>
                      ),
                    },
                  ]}
                />
              )}
            </div>
          </>
        )}
      </Modal>

      {/* 选择用户 */}
      <Modal
        title={`添加成员到角色 - ${selectedRole?.name ?? ''}`}
        open={userSelectModalVisible}
        onCancel={() => {
          setUserSelectModalVisible(false)
          setSelectedUserIds([])
        }}
        width={800}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setUserSelectModalVisible(false)
              setSelectedUserIds([])
            }}
          >
            取消
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={userSelectLoading}
            disabled={selectedUserIds.length === 0}
            onClick={addUsersToRole}
          >
            添加选中用户 ({selectedUserIds.length})
          </Button>,
        ]}
      >
        {userSelectLoading ? (
          <div className="text-center py-8">加载中...</div>
        ) : availableUsers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">暂无可添加的用户</div>
        ) : (
          <Table
            dataSource={availableUsers}
            rowKey="id"
            pagination={false}
            size="small"
            rowSelection={{
              type: 'checkbox',
              selectedRowKeys: selectedUserIds,
              onChange: keys => setSelectedUserIds(keys as number[]),
            }}
            columns={[
              { title: '用户名', dataIndex: 'username', key: 'username' },
              { title: '邮箱', dataIndex: 'email', key: 'email' },
              {
                title: '状态',
                dataIndex: 'status',
                key: 'status',
                render: s => <Tag color={s === 'active' ? 'green' : 'red'}>{s === 'active' ? '正常' : '禁用'}</Tag>,
              },
              {
                title: '创建时间',
                dataIndex: 'created_at',
                key: 'created_at',
                render: t => new Date(t).toLocaleString(),
              },
            ]}
          />
        )}
      </Modal>
    </div>
  )
}

export default RoleManagementPage
