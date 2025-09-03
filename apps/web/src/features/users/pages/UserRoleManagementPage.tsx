// apps/web/src/pages/admin/UserRoleManagementPage.tsx
import React, { useState, useEffect } from 'react'
import { Table, Button, Modal, Form, Select, App, Space, Tag, Card, Input, Avatar, Pagination } from 'antd'
import { createPaginationConfig } from '../../constants/pagination'
import { UserOutlined, SettingOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { api, ApiResult } from '../../lib/api'

// ==== 类型 ====
interface User {
  id: number
  username: string
  email: string
  role: string // 旧的角色字段（兼容）
  created_at: string
}
interface Role {
  id: number
  name: string
  code: string
  description: string
  is_system: boolean
  is_disabled: boolean
}
interface UserWithRoles extends User {
  roles: Role[]
}

// ==== 结果守卫与错误文本工具 ====
// 只保留 “成功” 的类型守卫；失败用布尔判断，避免与项目里 ApiFailure 的定义冲突
const isSuccess = <T,>(r: ApiResult<T>): r is { success: true; data: T } =>
  !!r && typeof r === 'object' && (r as any).success === true

const getErrText = (r: ApiResult<any>, fallback = '操作失败') =>
  ((r as any)?.message || (r as any)?.error || fallback) as string
// =================================

const UserRoleManagementPage: React.FC = () => {
  const { message } = App.useApp()
  const [users, setUsers] = useState<UserWithRoles[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null)
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([])
  const [searchText, setSearchText] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [form] = Form.useForm()

  const getRoleTagColor = (roleCode: string) => {
    const colorMap: Record<string, string> = {
      super_admin: 'red',
      admin: 'orange',
      teacher: 'blue',
      student: 'green',
    }
    return colorMap[roleCode] || 'default'
  }

  // 加载角色列表
  const loadRoles = async () => {
    try {
      const res: ApiResult<any> = await api.get('/roles')
      if (!isSuccess(res)) {
        message.error(getErrText(res, '加载角色列表失败'))
        return
      }
      const payload = res.data
      const list: Role[] = Array.isArray(payload)
        ? payload
        : payload?.roles ?? payload?.items ?? payload?.list ?? payload ?? []
      setRoles(list.filter((r: Role) => !r.is_disabled))
    } catch {
      message.error('加载角色列表失败')
    }
  }

  // 加载用户 + 每个用户的角色
  const loadUsers = async () => {
    try {
      setLoading(true)
      const res: ApiResult<any> = await api.get('/users')
      if (!isSuccess(res)) {
        message.error(getErrText(res, '加载用户列表失败'))
        setUsers([])
        return
      }

      const payload = res.data
      const usersData: User[] = Array.isArray(payload)
        ? payload
        : payload?.users ?? payload?.items ?? payload?.list ?? payload ?? []

      const usersWithRoles: UserWithRoles[] = await Promise.all(
        usersData.map(async user => {
          try {
            const roleRes: ApiResult<any> = await api.get(`/roles/users/${user.id}/roles`)
            const roleList: Role[] = isSuccess(roleRes)
              ? Array.isArray(roleRes.data)
                ? (roleRes.data as Role[])
                : (roleRes.data as any)?.roles ?? []
              : []
            return { ...user, roles: roleList }
          } catch {
            return { ...user, roles: [] }
          }
        })
      )
      setUsers(usersWithRoles)
    } catch {
      message.error('加载用户列表失败')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRoles()
    loadUsers()
  }, [])

  const openRoleModal = (user: UserWithRoles) => {
    setSelectedUser(user)
    setSelectedRoleIds(user.roles.map(r => r.id))
    setModalVisible(true)
  }

  const handleSaveRoles = async () => {
    if (!selectedUser) return
    try {
      const res: ApiResult<any> = await api.put(`/roles/users/${selectedUser.id}/roles`, {
        roleIds: selectedRoleIds,
      })
      if (!isSuccess(res)) {
        message.error(getErrText(res, '角色设置失败'))
        return
      }
      message.success('用户角色设置成功')
      setModalVisible(false)
      loadUsers()
    } catch (e: any) {
      message.error(e?.response?.data?.message || '角色设置失败')
    }
  }

  // 搜索 & 分页
  const filteredUsers = users.filter(
    u =>
      u.username.toLowerCase().includes(searchText.toLowerCase()) ||
      u.email.toLowerCase().includes(searchText.toLowerCase())
  )

  const handlePageChange = (page: number, size?: number) => {
    setCurrentPage(page)
    if (size && size !== pageSize) {
      setPageSize(size)
      setCurrentPage(1)
    }
  }
  const handlePageSizeChange = (_current: number, size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }
  const getCurrentPageUsers = () => {
    const start = (currentPage - 1) * pageSize
    return filteredUsers.slice(start, start + pageSize)
  }

  // 表格列
  const columns: ColumnsType<UserWithRoles> = [
    {
      title: '用户',
      key: 'user',
      render: (_, record) => (
        <Space>
          <Avatar icon={<UserOutlined />} />
          <div>
            <div className="font-medium">{record.username}</div>
            <div className="text-gray-500 text-sm">{record.email}</div>
          </div>
        </Space>
      ),
    },
    {
      title: '当前角色',
      key: 'roles',
      render: (_, record) => (
        <Space wrap>
          {record.roles.length ? (
            record.roles.map(role => (
              <Tag key={role.id} color={getRoleTagColor(role.code)}>
                {role.name}
              </Tag>
            ))
          ) : (
            <Tag>未分配角色</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '旧角色字段',
      dataIndex: 'role',
      key: 'old_role',
      render: text => <Tag>{text}</Tag>,
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: t => new Date(t).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button type="link" icon={<SettingOutlined />} onClick={() => openRoleModal(record)}>
          分配角色
        </Button>
      ),
    },
  ]

  return (
    <div className="p-6">
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">用户角色管理</h1>
          <div className="flex gap-4">
            <Input
              placeholder="搜索用户名或邮箱"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ width: 300 }}
              allowClear
            />
          </div>
        </div>

        <Table columns={columns} dataSource={getCurrentPageUsers()} rowKey="id" loading={loading} pagination={false} />

        <Pagination
          current={currentPage}
          total={filteredUsers.length}
          pageSize={pageSize}
          onChange={handlePageChange}
          onShowSizeChange={handlePageSizeChange}
          {...createPaginationConfig()}
        />
      </Card>

      {/* 分配角色弹窗 */}
      <Modal
        title={`分配角色 - ${selectedUser?.username ?? ''}`}
        open={modalVisible}
        onOk={handleSaveRoles}
        onCancel={() => setModalVisible(false)}
        width={600}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        {selectedUser && (
          <div>
            <div className="mb-4 p-4 bg-gray-50 rounded">
              <Space>
                <Avatar icon={<UserOutlined />} />
                <div>
                  <div className="font-medium">{selectedUser.username}</div>
                  <div className="text-gray-500">{selectedUser.email}</div>
                </div>
              </Space>
            </div>

            <Form form={form} layout="vertical">
              <Form.Item label="选择角色">
                <Select
                  mode="multiple"
                  placeholder="请选择角色"
                  value={selectedRoleIds}
                  onChange={setSelectedRoleIds}
                  options={roles.map(role => ({
                    value: role.id,
                    label: (
                      <Space>
                        <Tag color={getRoleTagColor(role.code)}>{role.name}</Tag>
                        <span style={{ color: '#999' }}>({role.code})</span>
                      </Space>
                    ),
                  }))}
                />
              </Form.Item>

              <div className="text-sm text-gray-500">
                <p>当前角色：</p>
                <Space wrap className="mt-1">
                  {selectedUser.roles.length ? (
                    selectedUser.roles.map(role => (
                      <Tag key={role.id} color={getRoleTagColor(role.code)}>
                        {role.name}
                      </Tag>
                    ))
                  ) : (
                    <Tag>未分配角色</Tag>
                  )}
                </Space>
              </div>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default UserRoleManagementPage
