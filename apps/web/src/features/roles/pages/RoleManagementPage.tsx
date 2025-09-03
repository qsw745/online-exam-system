import {
  ApartmentOutlined,
  DeleteOutlined,
  EditOutlined,
  MoreOutlined,
  PlusOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { OrgAPI as orgs } from '@features/orgs/api'
import { api } from '@shared/api/http'
import { useAuth } from '@shared/contexts/AuthContext'
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

/** ===== ApiResult 守卫（与 @shared/api/http 兼容） ===== */
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
const getMsg = (r: any, fallback = '请求失败') =>
  r && typeof r === 'object' ? (r as any).message ?? (r as any).error ?? fallback : fallback
/** ===================================================== */

interface Role {
  id: number
  name: string
  code: string
  description: string
  is_system: boolean
  is_disabled: boolean
  sort_order?: number
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

type OrgTreeNode = {
  key: number
  title: string
  children?: OrgTreeNode[]
}

const RoleManagementPage: React.FC = () => {
  const { message, modal } = App.useApp()
  const { user } = useAuth()

  const [roleList, setRoleList] = useState<Role[]>([])
  const [menus, setMenus] = useState<MenuItem[]>([])

  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [permissionModalVisible, setPermissionModalVisible] = useState(false)

  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)

  const [selectedMenuIds, setSelectedMenuIds] = useState<number[]>([])
  const [nextSortOrder, setNextSortOrder] = useState<number>(1)

  const [form] = Form.useForm()

  // 成员相关
  const [memberModalVisible, setMemberModalVisible] = useState(false)
  const [roleUsers, setRoleUsers] = useState<RoleUser[]>([])
  const [memberLoading, setMemberLoading] = useState(false)

  // 选择用户
  const [userSelectModalVisible, setUserSelectModalVisible] = useState(false)
  const [availableUsers, setAvailableUsers] = useState<User[]>([])
  const [userSelectLoading, setUserSelectLoading] = useState(false)
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([])

  // 选择机构
  const [orgSelectModalVisible, setOrgSelectModalVisible] = useState(false)
  const [orgTree, setOrgTree] = useState<OrgTreeNode[]>([])
  const [orgTreeLoading, setOrgTreeLoading] = useState(false)
  const [checkedOrgIds, setCheckedOrgIds] = useState<number[]>([])

  // 分页 & 搜索
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [searchKeyword, setSearchKeyword] = useState('')

  /** ===== 工具：把可能的返回体归一到数组 ===== */
  const ensureArray = <T,>(val: any, fallback: T[] = []): T[] => {
    if (Array.isArray(val)) return val as T[]
    if (val && typeof val === 'object') {
      // 常见容器字段：items / list / data / rows / results
      const guess = (val.roles ??
        val.items ??
        val.list ??
        val.data ??
        val.rows ??
        val.results ??
        val.menus ??
        val.users) as any
      return Array.isArray(guess) ? (guess as T[]) : fallback
    }
    return fallback
  }
  const pickTotal = (val: any, fallback = 0) =>
    Number(
      (val && typeof val === 'object' && (val.total ?? val.count ?? val.pagination?.total ?? val.meta?.total)) ??
        fallback
    ) || fallback

  /** ====== 加载角色（统一归一化，避免 {}.roles 报错） ====== */
  const loadRoles = async (page = currentPage, size = pageSize, keyword = searchKeyword) => {
    try {
      setLoading(true)
      const resp: ApiResult<any> = await api.get('/roles', { params: { page, limit: size, keyword } })
      if (!isSuccess(resp)) {
        message.error(getMsg(resp, '加载角色列表失败'))
        setRoleList([])
        setTotal(0)
        return
      }
      const d: any = resp.data as any
      // 归一：列表与总数
      const list = ensureArray<Role>(d, [])
      const t = list.length > 0 ? pickTotal(d, list.length) : pickTotal(d, 0)
      setRoleList(list)
      setTotal(t)
      setCurrentPage(page)
    } catch (err) {
      console.error('加载角色列表失败:', err)
      message.error('加载角色列表失败')
      setRoleList([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  /** ====== 加载菜单 ====== */
  const loadMenus = async () => {
    try {
      const resp: ApiResult<any> = await api.get('/menus')
      if (!isSuccess(resp)) {
        message.error(getMsg(resp, '加载菜单失败'))
        setMenus([])
        return
      }
      const d: any = resp.data as any
      const list = ensureArray<MenuItem>(d, [])
      setMenus(list)
    } catch (e) {
      console.error('加载菜单失败:', e)
      message.error('加载菜单失败')
      setMenus([])
    }
  }

  /** ====== 加载某角色的菜单勾选 ====== */
  const loadRoleMenus = async (roleId: number) => {
    try {
      const resp: ApiResult<any> = await api.get(`/roles/${roleId}/menus`)
      if (!isSuccess(resp)) {
        message.error(getMsg(resp, '加载角色权限失败'))
        setSelectedMenuIds([])
        return
      }
      const list = ensureArray<{ id: number }>(resp.data, [])
      setSelectedMenuIds(list.map(m => m.id))
    } catch (e) {
      console.error('加载角色权限失败:', e)
      message.error('加载角色权限失败')
      setSelectedMenuIds([])
    }
  }

  useEffect(() => {
    loadRoles()
    loadMenus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ====== 菜单树（children 必选树）======
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

  // ====== 提交（新增/更新）======
  const handleSubmit = async (values: any) => {
    try {
      if (editingRole) {
        const resp: ApiResult<any> = await api.put(`/roles/${editingRole.id}`, values)
        if (!isSuccess(resp)) return message.error(getMsg(resp, '角色更新失败'))
        message.success('角色更新成功')
        loadRoles()
      } else {
        const resp: ApiResult<any> = await api.post('/roles', values)
        if (!isSuccess(resp)) return message.error(getMsg(resp, '角色创建失败'))
        message.success('角色创建成功')
        loadRoles()
      }
      setModalVisible(false)
      setEditingRole(null)
      form.resetFields()
    } catch (e) {
      console.error(e)
      message.error('操作失败')
    }
  }

  // ====== 删除 ======
  const handleDelete = async (role: Role) => {
    try {
      const resp: ApiResult<any> = await api.delete(`/roles/${role.id}`)
      if (!isSuccess(resp)) return message.error(getMsg(resp, '删除失败'))
      message.success('角色删除成功')
      loadRoles()
    } catch (e: any) {
      message.error(e?.response?.data?.message || '删除失败')
    }
  }

  // ====== 保存权限 ======
  const handleSavePermissions = async () => {
    if (!selectedRole) return
    try {
      const resp: ApiResult<any> = await api.post(`/roles/${selectedRole.id}/menus`, { menu_ids: selectedMenuIds })
      if (!isSuccess(resp)) return message.error(getMsg(resp, '权限设置失败'))
      message.success('权限设置成功')
      setPermissionModalVisible(false)
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
      const resp: ApiResult<any> = await api.get(`/roles/${roleId}/users`)
      if (!isSuccess(resp)) {
        message.error(getMsg(resp, '加载角色用户列表失败'))
        setRoleUsers([])
        return
      }
      const list = ensureArray<RoleUser>(resp.data, [])
      setRoleUsers(list)
    } catch (e: any) {
      console.error('加载角色用户列表失败:', e)
      message.error(e?.response?.data?.message || '加载角色用户列表失败')
      setRoleUsers([])
    } finally {
      setMemberLoading(false)
    }
  }

  const openMemberModal = async (role: Role) => {
    setSelectedRole(role)
    await loadRoleUsers(role.id)
    setMemberModalVisible(true)
  }

  const loadAvailableUsers = async (roleId: number) => {
    try {
      setUserSelectLoading(true)
      const allUsers: ApiResult<any> = await api.get('/users', { params: { page: 1, limit: 1000 } })
      if (!isSuccess(allUsers)) {
        message.error(getMsg(allUsers, '加载用户列表失败'))
        return
      }
      const allList = ensureArray<User>(allUsers.data, [])
      const roleUsersResp: ApiResult<any> = await api.get(`/roles/${roleId}/users`)
      const currentRoleUsers = isSuccess(roleUsersResp) ? ensureArray<RoleUser>(roleUsersResp.data, []) : []
      const currentIds = new Set(currentRoleUsers.map(u => u.id))
      const canAdd = allList.filter(u => !currentIds.has(u.id) && u.status === 'active')
      setAvailableUsers(canAdd)
    } catch (e) {
      console.error('加载用户列表失败:', e)
      message.error('加载用户列表失败')
      setAvailableUsers([])
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
    if (!selectedRole || selectedUserIds.length === 0) return message.warning('请选择要添加的用户')
    try {
      setUserSelectLoading(true)
      const resp: ApiResult<any> = await api.post(`/roles/${selectedRole.id}/users`, { user_ids: selectedUserIds })
      if (!isSuccess(resp)) return message.error(getMsg(resp, '添加用户失败'))
      message.success(`成功添加 ${selectedUserIds.length} 个用户到角色`)
      setUserSelectModalVisible(false)
      setSelectedUserIds([])
      await loadRoleUsers(selectedRole.id)
    } catch (e: any) {
      console.error('添加用户到角色失败:', e)
      message.error(e?.response?.data?.message || '添加用户失败')
    } finally {
      setUserSelectLoading(false)
    }
  }

  const removeUserFromRole = async (roleId: number, userId: number) => {
    try {
      setMemberLoading(true)
      const resp: ApiResult<any> = await api.delete(`/roles/${roleId}/users/${userId}`)
      if (!isSuccess(resp)) return message.error(getMsg(resp, '移除用户失败'))
      setRoleUsers(prev => prev.filter(u => u.id !== userId))
      message.success('已从角色中移除该用户')
      await loadRoleUsers(roleId)
      await loadAvailableUsers(roleId)
    } catch (e: any) {
      console.error('移除用户失败:', e)
      message.error(e?.response?.data?.message || '移除用户失败')
    } finally {
      setMemberLoading(false)
    }
  }

  // ====== 机构（orgs.tree）======
  const buildOrgTree = (nodes: any[] = []): OrgTreeNode[] =>
    nodes.map(n => ({
      key: n.id,
      title: n.name,
      children: n.children ? buildOrgTree(n.children) : undefined,
    }))

  const loadOrgTree = async () => {
    try {
      setOrgTreeLoading(true)
      const res: ApiResult<any[]> = await orgs.tree()
      if (!isSuccess(res)) {
        setOrgTree([])
        return message.error(getMsg(res, '加载机构树失败'))
      }
      const t = buildOrgTree(res.data || [])
      setOrgTree(t)
    } catch (e: any) {
      console.error('加载机构树失败:', e)
      message.error(e?.message || '加载机构树失败')
      setOrgTree([])
    } finally {
      setOrgTreeLoading(false)
    }
  }

  const openOrgSelectModal = async () => {
    if (!selectedRole) return
    setCheckedOrgIds([])
    await loadOrgTree()
    setOrgSelectModalVisible(true)
  }

  const addOrgsToRole = async () => {
    if (!selectedRole) return
    if (checkedOrgIds.length === 0) return message.warning('请选择要关联的机构')
    try {
      const resp: ApiResult<any> = await api.post(`/roles/${selectedRole.id}/orgs`, { org_ids: checkedOrgIds })
      if (!isSuccess(resp)) return message.error(getMsg(resp, '机构关联失败'))
      message.success('机构关联成功')
      setOrgSelectModalVisible(false)
      setCheckedOrgIds([])
    } catch (e: any) {
      console.error('机构关联失败:', e)
      message.error(e?.response?.data?.message || '机构关联失败（请确认后端已实现 /roles/:id/orgs）')
    }
  }

  // 生成编码 & 联动
  const generateRoleCode = () => {
    const roleName = form.getFieldValue('name')
    if (!roleName || roleName.trim() === '') return message.warning('请先输入角色名称')
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

  // 新建时默认排序
  const prepareDefaultSortOrder = async () => {
    try {
      if (!user?.id) {
        setNextSortOrder(1)
        form.setFieldsValue({ sort_order: 1 })
        return
      }
      // 没有 next-sort-order 接口就用“当前最大 + 1”
      const maxOrder = Math.max(0, ...roleList.map(r => r.sort_order ?? 0))
      const next = maxOrder + 1
      setNextSortOrder(next)
      form.setFieldsValue({ sort_order: next })
    } catch {
      setNextSortOrder(1)
      form.setFieldsValue({ sort_order: 1 })
    }
  }

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
      width: 140,
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
          { key: 'members', icon: <TeamOutlined />, label: '添加用户', onClick: () => openMemberModal(record) },
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
                await prepareDefaultSortOrder()
                setModalVisible(true)
              }}
            >
              新建角色
            </Button>
          </div>
        </div>

        <Table columns={columns} dataSource={roleList} rowKey="id" loading={loading} pagination={false} />

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
                initialValue={nextSortOrder}
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
        title={`添加用户 - ${selectedRole?.name ?? ''}`}
        open={memberModalVisible}
        onCancel={() => setMemberModalVisible(false)}
        width={900}
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
                <Space size="middle">
                  <h3 className="text-lg font-medium">当前用户</h3>
                  <Button type="primary" icon={<PlusOutlined />} onClick={openUserSelectModal}>
                    添加用户
                  </Button>
                  <Button icon={<ApartmentOutlined />} onClick={openOrgSelectModal}>
                    添加机构
                  </Button>
                </Space>
                <Button size="small" onClick={() => loadRoleUsers(selectedRole.id)}>
                  刷新
                </Button>
              </div>

              {memberLoading ? (
                <div className="text-center py-8">加载中...</div>
              ) : roleUsers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">该角色暂无用户</div>
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
        title={`添加用户到角色 - ${selectedRole?.name ?? ''}`}
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

      {/* 选择机构 */}
      <Modal
        title={`添加机构到角色 - ${selectedRole?.name ?? ''}`}
        open={orgSelectModalVisible}
        onCancel={() => {
          setOrgSelectModalVisible(false)
          setCheckedOrgIds([])
        }}
        width={600}
        okText="关联所选机构"
        cancelText="取消"
        onOk={addOrgsToRole}
      >
        {orgTreeLoading ? (
          <div className="text-center py-8">机构加载中...</div>
        ) : orgTree.length === 0 ? (
          <div className="text-center py-8 text-gray-500">暂无机构数据</div>
        ) : (
          <div style={{ maxHeight: 480, overflow: 'auto', border: '1px solid #f0f0f0', borderRadius: 8, padding: 8 }}>
            <Tree
              showIcon
              icon={<ApartmentOutlined />}
              checkable
              defaultExpandAll
              treeData={orgTree as any}
              checkedKeys={checkedOrgIds}
              onCheck={(keys: any) => setCheckedOrgIds((Array.isArray(keys) ? keys : keys?.checked) as number[])}
            />
          </div>
        )}
        <div style={{ marginTop: 8, color: '#8c8c8c' }}>
          说明：提交后会调用 <code>POST /roles/:roleId/orgs</code> 进行角色与机构的关联。
        </div>
      </Modal>
    </div>
  )
}

export default RoleManagementPage
