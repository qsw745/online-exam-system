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
import React, { useEffect, useState } from 'react'
import { createPaginationConfig } from '../../constants/pagination'
import { useAuth } from '../../contexts/AuthContext'
import { api } from '../../lib/api'

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

  // 成员管理相关状态
  const [memberModalVisible, setMemberModalVisible] = useState(false)
  const [roleUsers, setRoleUsers] = useState<RoleUser[]>([])
  const [memberLoading, setMemberLoading] = useState(false)

  // 用户选择相关状态
  const [userSelectModalVisible, setUserSelectModalVisible] = useState(false)
  const [availableUsers, setAvailableUsers] = useState<User[]>([])
  const [userSelectLoading, setUserSelectLoading] = useState(false)
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([])

  // 分页相关状态
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [searchKeyword, setSearchKeyword] = useState('')

  // 加载角色列表
  const loadRoles = async (page = currentPage, size = pageSize, keyword = searchKeyword) => {
    try {
      setLoading(true)
      const params = {
        page,
        pageSize: size,
        ...(keyword && { keyword }),
      }
      const response = await api.get('/roles', { params })
      if (response.data) {
        setRoles(response.data.roles || response.data.data)
        setTotal(response.data.total || response.data.data.length)
        setCurrentPage(page)
        setPageSize(size)
      } else {
        message.error('加载角色列表失败')
      }
    } catch (error) {
      console.error('加载角色列表失败:', error)
      message.error('加载角色列表失败')
    } finally {
      setLoading(false)
    }
  }

  // 加载菜单列表
  const loadMenus = async () => {
    try {
      console.log('=== 开始加载菜单数据 ===')
      const response = await api.get('/menu/menus')
      console.log('菜单API原始响应:', response)
      console.log('菜单API响应数据:', response.data)
      console.log('响应数据类型:', typeof response.data)

      let menuData: any[] = []

      // 处理不同的响应格式
      if (response.data) {
        if (Array.isArray(response.data)) {
          // 直接返回数组的情况
          menuData = response.data
          console.log('检测到直接数组格式，菜单数量:', menuData.length)
        } else if (response.data.data && Array.isArray(response.data.data)) {
          // 标准格式 {success: true, data: []}
          menuData = response.data.data
          console.log('检测到标准格式，菜单数量:', menuData.length)
        } else if (response.data.success && response.data.data) {
          // 另一种标准格式
          menuData = response.data.data
          console.log('检测到success格式，菜单数量:', menuData.length)
        } else {
          console.error('未知的响应格式:', response.data)
        }
      }

      if (menuData.length > 0) {
        console.log('菜单数据预览:', menuData.slice(0, 3))
        setMenus(menuData)
        console.log('菜单状态已设置，数组长度:', menuData.length)
        message.success(`成功加载 ${menuData.length} 个菜单项`)
      } else {
        console.error('没有找到有效的菜单数据:', {
          responseData: response.data,
          isArray: Array.isArray(response.data),
          hasDataField: !!(response.data && response.data.data),
        })
        message.error('没有找到有效的菜单数据')
      }
    } catch (error) {
      console.error('=== 加载菜单失败 ===', error)
      message.error('加载菜单失败: ' + (error as Error).message)
    }
  }

  // 加载角色菜单权限
  const loadRoleMenus = async (roleId: number) => {
    try {
      const response = await api.get(`/roles/${roleId}/menus`)
      if (response.data && response.data.success) {
        setSelectedMenuIds(response.data.data.map((menu: MenuItem) => menu.id))
      }
    } catch (error) {
      console.error('加载角色权限失败:', error)
      message.error('加载角色权限失败')
    }
  }

  useEffect(() => {
    loadRoles()
    loadMenus()
  }, [])

  // 添加调试信息
  useEffect(() => {
    console.log('菜单状态更新:', menus)
    console.log('菜单数量:', menus.length)
  }, [menus])

  // 分页处理函数
  const handlePageChange = (page: number) => {
    loadRoles(page, pageSize, searchKeyword)
  }

  const handlePageSizeChange = (size: number) => {
    loadRoles(1, size, searchKeyword)
  }

  // 搜索处理函数
  const handleSearch = (value: string) => {
    setSearchKeyword(value)
    loadRoles(1, pageSize, value)
  }

  // 重置搜索
  const handleResetSearch = () => {
    setSearchKeyword('')
    loadRoles(1, pageSize, '')
  }

  // 将菜单列表转换为树形结构
  const buildMenuTree = (menuList: MenuItem[]): DataNode[] => {
    console.log('构建菜单树，输入菜单列表:', menuList)
    const menuMap = new Map<number, MenuItem & { children: MenuItem[] }>()
    const rootMenus: (MenuItem & { children: MenuItem[] })[] = []

    // 初始化所有菜单项
    menuList.forEach(menu => {
      menuMap.set(menu.id, { ...menu, children: [] })
    })

    // 构建树形结构
    menuList.forEach(menu => {
      const menuItem = menuMap.get(menu.id)!
      if (menu.parent_id && menuMap.has(menu.parent_id)) {
        menuMap.get(menu.parent_id)!.children.push(menuItem)
      } else {
        rootMenus.push(menuItem)
      }
    })

    console.log('根菜单项:', rootMenus)

    // 转换为 Tree 组件需要的格式
    const convertToTreeData = (items: (MenuItem & { children: MenuItem[] })[]): DataNode[] => {
      return items.map(item => ({
        key: item.id,
        title: item.title,
        children: item.children.length > 0 ? convertToTreeData(item.children) : undefined,
      }))
    }

    const treeData = convertToTreeData(rootMenus)
    console.log('最终树形数据:', treeData)
    return treeData
  }

  // 处理角色表单提交
  const handleSubmit = async (values: any) => {
    try {
      if (editingRole) {
        // 更新角色
        const response = await api.put(`/roles/${editingRole.id}`, values)
        if (response.data.success) {
          message.success('角色更新成功')
          loadRoles()
        }
      } else {
        // 创建角色
        const response = await api.post('/roles', values)
        if (response.data.success) {
          message.success('角色创建成功')
          loadRoles()
        }
      }
      setModalVisible(false)
      setEditingRole(null)
      form.resetFields()
    } catch (error: any) {
      console.log(error)
      message.error(error.message || error.response?.data?.message || '操作失败')
    }
  }

  // 删除角色
  const handleDelete = async (role: Role) => {
    try {
      const response = await api.delete(`/roles/${role.id}`)
      if (response.data.success) {
        message.success('角色删除成功')
        loadRoles()
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '删除失败')
    }
  }

  // 保存角色权限
  const handleSavePermissions = async () => {
    if (!selectedRole) return

    try {
      const response = await api.put(`/roles/${selectedRole.id}/menus`, {
        menuIds: selectedMenuIds,
      })
      if (response.data) {
        message.success('权限设置成功')
        setPermissionModalVisible(false)
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '权限设置失败')
    }
  }

  // 打开权限设置弹窗
  const openPermissionModal = async (role: Role) => {
    setSelectedRole(role)
    await loadRoleMenus(role.id)
    setPermissionModalVisible(true)
  }

  // 加载角色用户列表
  const loadRoleUsers = async (roleId: number) => {
    try {
      setMemberLoading(true)
      const response = await api.get(`/roles/${roleId}/users`)
      if (response.data) {
        setRoleUsers(response.data)
      } else {
        message.error('加载角色用户列表失败')
      }
    } catch (error: any) {
      console.error('加载角色用户列表失败:', error)
      message.error(error.response?.data?.message || '加载角色用户列表失败')
    } finally {
      setMemberLoading(false)
    }
  }

  // 打开成员管理弹窗
  const openMemberModal = async (role: Role) => {
    setSelectedRole(role)
    await loadRoleUsers(role.id)
    setMemberModalVisible(true)
  }

  // 加载可用用户列表（排除已分配给当前角色的用户）
  const loadAvailableUsers = async (roleId: number) => {
    try {
      setUserSelectLoading(true)
      const response = await api.get('/users')
      if (response.data) {
        // 获取当前角色的用户列表
        const roleUsersResponse = await api.get(`/roles/${roleId}/users`)
        const currentRoleUserIds = roleUsersResponse.data.success
          ? roleUsersResponse.data.data.map((user: RoleUser) => user.id)
          : []

        // 过滤掉已分配给当前角色的用户
        const availableUsers = response.data.users.filter(
          (user: User) => !currentRoleUserIds.includes(user.id) && user.status === 'active'
        )
        setAvailableUsers(availableUsers)
      }
    } catch (error: any) {
      console.error('加载用户列表失败:', error)
      message.error('加载用户列表失败')
    } finally {
      setUserSelectLoading(false)
    }
  }

  // 打开用户选择弹窗
  const openUserSelectModal = async () => {
    if (!selectedRole) return
    setSelectedUserIds([])
    await loadAvailableUsers(selectedRole.id)
    setUserSelectModalVisible(true)
  }

  // 添加用户到角色
  const addUsersToRole = async () => {
    if (!selectedRole || selectedUserIds.length === 0) {
      message.warning('请选择要添加的用户')
      return
    }

    try {
      setUserSelectLoading(true)
      const response = await api.post(`/roles/${selectedRole.id}/users`, {
        userIds: selectedUserIds,
      })

      if (response.data) {
        message.success(`成功添加 ${selectedUserIds.length} 个用户到角色`)
        setUserSelectModalVisible(false)
        setSelectedUserIds([])
        // 重新加载角色用户列表
        await loadRoleUsers(selectedRole.id)
      }
    } catch (error: any) {
      console.error('添加用户到角色失败:', error)
      message.error(error.response?.data?.message || '添加用户失败')
    } finally {
      setUserSelectLoading(false)
    }
  }

  // 从角色移除单个用户
  const removeUserFromRole = async (roleId: number, userId: number) => {
    try {
      setMemberLoading(true)
      // 常见写法：RESTful DELETE /roles/{roleId}/users/{userId}
      const resp = await api.delete(`/roles/${roleId}/users/${userId}`)

      // 兼容各种返回格式：只要 2xx 都当成功
      if (resp.status >= 200 && resp.status < 300 && (resp.data?.success ?? true)) {
        message.success('已从角色中移除该用户')
        await loadRoleUsers(roleId) // 刷新成员列表
        await loadAvailableUsers(roleId) // 让“可添加用户”也立刻更新
        return
      }

      throw new Error(resp.data?.message || '移除失败')
    } catch (e: any) {
      console.error('移除用户失败:', e)
      message.error(e?.message || e?.response?.data?.message || '移除用户失败')
    } finally {
      setMemberLoading(false)
    }
  }

  // 生成角色编码
  const generateRoleCode = () => {
    const roleName = form.getFieldValue('name')
    if (!roleName || roleName.trim() === '') {
      message.warning('请先输入角色名称')
      return
    }

    // 基于角色名称生成编码
    let code = roleName
      .toLowerCase()
      .replace(/[\s\u4e00-\u9fa5]+/g, '_') // 将空格和中文字符替换为下划线
      .replace(/[^a-z0-9_]/g, '') // 移除非字母数字下划线字符
      .replace(/_+/g, '_') // 合并多个下划线
      .replace(/^_|_$/g, '') // 移除首尾下划线

    // 如果生成的编码为空，使用默认前缀
    if (!code) {
      code = 'role'
    }

    form.setFieldsValue({ code })
  }

  // 监听角色名称变化，自动生成编码
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    // 只在新建角色且编码字段为空时自动生成
    if (!editingRole && name && !form.getFieldValue('code')) {
      const code = name
        .toLowerCase()
        .replace(/[\s\u4e00-\u9fa5]+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')

      if (code) {
        form.setFieldsValue({ code })
      }
    }
  }

  // 表格列定义
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
    {
      title: '角色编码',
      dataIndex: 'code',
      key: 'code',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: text => new Date(text).toLocaleString(),
    },
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
          {
            key: 'members',
            icon: <TeamOutlined />,
            label: '成员管理',
            onClick: () => openMemberModal(record),
          },
        ]

        if (!record.is_system) {
          menuItems.push({
            key: 'delete',
            icon: <DeleteOutlined />,
            label: '删除',
            danger: true,
            onClick: () => {
              Modal.confirm({
                title: '确定要删除这个角色吗？',
                content: '删除后将无法恢复',
                okText: '确定',
                cancelText: '取消',
                onOk: () => handleDelete(record),
              })
            },
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
              onSearch={handleSearch}
              onClear={handleResetSearch}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={async () => {
                setEditingRole(null)
                form.resetFields()

                // 获取下一个排序号
                try {
                  if (!user || !user.id) {
                    console.error('用户未登录，无法获取排序号')
                    message.error('请先登录')
                    setNextSortOrder(1)
                    form.setFieldsValue({ sort_order: 1 })
                    return
                  }

                  console.log('正在调用获取排序号接口...')
                  const response = await api.get('/roles/next-sort-order')
                  console.log('获取排序号响应:', response)
                  if (response.data.success) {
                    console.log('成功获取排序号:', response.data.data)
                    setNextSortOrder(response.data.data)
                    form.setFieldsValue({ sort_order: response.data.data })
                  } else {
                    console.error('获取排序号失败 - 响应不成功:', response.data)
                    setNextSortOrder(1)
                    form.setFieldsValue({ sort_order: 1 })
                  }
                } catch (error: any) {
                  console.error('获取排序号失败 - 网络错误:', error)
                  console.error('错误详情:', error.response?.data)
                  console.error('错误状态码:', error.response?.status)

                  if (error.response?.status === 401) {
                    console.error('认证失败，可能需要重新登录')
                    message.error('认证失败，请重新登录')
                  } else {
                    message.error('获取排序号失败，将使用默认值')
                  }

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
            {...createPaginationConfig({
              current: currentPage,
              total: total || 0,
              pageSize: pageSize,
              onChange: handlePageChange,
              onShowSizeChange: (current, newPageSize) => handlePageSizeChange(newPageSize),
            })}
          />
        </div>
      </Card>

      {/* 角色编辑弹窗 */}
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
        destroyOnHidden={true}
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

      {/* 权限设置弹窗 */}
      <Modal
        title={`设置角色权限 - ${selectedRole?.name}`}
        open={permissionModalVisible}
        onOk={handleSavePermissions}
        onCancel={() => setPermissionModalVisible(false)}
        width={800}
        okText="保存"
        cancelText="取消"
      >
        {selectedRole && (
          <div>
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
                <Button
                  size="small"
                  onClick={() => {
                    console.log('手动刷新菜单数据')
                    loadMenus()
                  }}
                >
                  刷新菜单
                </Button>
              </div>
              {menus.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div>暂无菜单数据，请检查菜单配置</div>
                  <div style={{ fontSize: 12, marginTop: 8 }}>调试: menus数组长度={menus.length}</div>
                </div>
              ) : (
                <div>
                  <div style={{ marginBottom: 16, fontSize: 12, color: '#666' }}>
                    调试信息: 菜单数量={menus.length}, 选中菜单={selectedMenuIds.length}
                  </div>
                  <div style={{ marginBottom: 16, fontSize: 12, color: '#666' }}>
                    菜单列表: {menus.map(m => `${m.id}:${m.title}`).join(', ')}
                  </div>
                  <div style={{ marginBottom: 16, fontSize: 12, color: '#666' }}>
                    树形数据节点数: {buildMenuTree(menus).length}
                  </div>
                  <Tree
                    checkable
                    checkedKeys={selectedMenuIds}
                    onCheck={checkedKeys => {
                      console.log('Tree选中变化:', checkedKeys)
                      console.log('当前menus状态:', menus)
                      console.log('当前树形数据:', buildMenuTree(menus))
                      setSelectedMenuIds(checkedKeys as number[])
                    }}
                    treeData={buildMenuTree(menus)}
                    height={400}
                    defaultExpandAll
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* 成员管理弹窗 */}
      <Modal
        title={`成员管理 - ${selectedRole?.name}`}
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
          <div>
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
                <div className="text-center py-8">
                  <span>加载中...</span>
                </div>
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
                          onClick={() => {
                            modal.confirm({
                              title: '确定要移除该用户吗？',
                              content: `将从角色"${selectedRole.name}"中移除用户"${record.username}"`,
                              okText: '确定',
                              cancelText: '取消',
                              onOk: () => removeUserFromRole(selectedRole!.id, record.id),
                            })
                          }}
                        >
                          移除
                        </Button>
                      ),
                    },
                  ]}
                />
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* 用户选择弹窗 */}
      <Modal
        title={`添加成员到角色 - ${selectedRole?.name}`}
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
          <div className="text-center py-8">
            <span>加载中...</span>
          </div>
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
              onChange: selectedRowKeys => {
                setSelectedUserIds(selectedRowKeys as number[])
              },
            }}
            columns={[
              {
                title: '用户名',
                dataIndex: 'username',
                key: 'username',
              },
              {
                title: '邮箱',
                dataIndex: 'email',
                key: 'email',
              },
              {
                title: '状态',
                dataIndex: 'status',
                key: 'status',
                render: status => (
                  <Tag color={status === 'active' ? 'green' : 'red'}>{status === 'active' ? '正常' : '禁用'}</Tag>
                ),
              },
              {
                title: '创建时间',
                dataIndex: 'created_at',
                key: 'created_at',
                render: text => new Date(text).toLocaleString(),
              },
            ]}
          />
        )}
      </Modal>
    </div>
  )
}

export default RoleManagementPage
