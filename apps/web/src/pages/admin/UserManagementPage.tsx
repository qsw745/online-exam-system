import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import { 
  App,
  Input, 
  Select, 
  Table, 
  Button, 
  Tag, 
  Space, 
  Modal, 
  Form, 
  Card, 
  Row, 
  Col, 
  Avatar, 
  Typography, 
  Statistic, 
  Divider,
  Pagination,
  Dropdown,
  Menu
} from 'antd'
import { SearchOutlined, FilterOutlined, EditOutlined, EyeOutlined, UserOutlined, StarOutlined, DeleteOutlined, StopOutlined, KeyOutlined, ExclamationCircleOutlined, MoreOutlined } from '@ant-design/icons'
import { api, users } from '../../lib/api'
import {
  Users,
  Star
} from 'lucide-react'
import { createPaginationConfig } from '../../constants/pagination'

const { Search } = Input
const { Option } = Select
const { Title, Paragraph, Text } = Typography

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
}

// 防抖函数，延迟执行搜索
const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
};

const UserManagementPage: React.FC = () => {
  const { message, modal } = App.useApp()
  const { user } = useAuth()
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()
  const [userList, setUserList] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalUsers, setTotalUsers] = useState(0)
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  
  // 创建搜索输入框的引用
  const searchInputRef = useRef<HTMLInputElement>(null)
  
  // 不再使用防抖处理搜索词，直接在输入变化时触发搜索
  
  const [limit, setLimit] = useState(20)

  // 当防抖后的搜索词变化时，重置页码到第一页并保持输入框焦点
  useEffect(() => {
    setCurrentPage(1)
    // 保持搜索框的焦点
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [roleFilter])
  // 页面初始化时加载用户数据
  useEffect(() => {
    loadUsers()
  }, [])

  // 当页码、角色筛选或每页条数变化时，加载用户数据
  // 搜索词的变化已经在另一个useEffect中处理
  useEffect(() => {
    loadUsers()
  }, [currentPage, roleFilter, limit])

  // 标记是否是搜索触发的加载
  const isSearchTriggered = useRef(true)
  // 标记是否正在使用输入法
  const isComposing = useRef(false)

  // 移除对debouncedSearchTerm的依赖，直接在输入变化时触发搜索

  const loadUsers = async () => {
    try {
      setLoading(true)
      console.log('开始加载用户数据，参数:', { page: currentPage, limit, search: searchTerm, role: roleFilter })
      
      // 确保使用当前的searchTerm而不是debouncedSearchTerm
      const { data } = await users.getAll({
        page: currentPage,
        limit,
        search: searchTerm, // 使用当前的searchTerm
        role: roleFilter
      })

      console.log('用户数据加载成功:', data)
      setUserList(data.users || [])
      setTotalUsers(data.total || 0)
      console.log('设置用户数据:', data.users?.length, '条记录，总计:', data.total)
    } catch (error: any) {
      console.error('加载用户列表错误:', error)
      message.error(error.response?.data?.message || '加载用户失败')
    } finally {
      setLoading(false)
      console.log('用户数据加载完成，loading状态已设置为false')
      
      // 在加载完成后聚焦到搜索框
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus()
        }
      }, 0)
    }
  }

  const loadUserDetail = async (userId: number) => {
    try {
      const { data } = await users.getById(userId)

      setSelectedUser(data)
      setShowDetailModal(true)
    } catch (error: any) {
      console.error('加载用户详情错误:', error)
      message.error(error.response?.data?.message || '加载用户详情失败')
    }
  }



  const handleEditUser = async (values: any) => {
    if (!editingUser) return

    try {
      // 直接使用api调用，确保正确处理响应
      const response = await api.put(`/users/${editingUser.id}`, values)
      
      if (!response.success) {
        throw new Error(response.error || '更新失败')
      }
      
      // 更新本地用户列表中的用户数据
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === editingUser.id 
            ? { 
                ...user, 
                role: values.role, 
                nickname: values.nickname, 
                school: values.school, 
                class_name: values.class_name 
              } 
            : user
        )
      )
      
      message.success('用户信息更新成功')
      setShowEditModal(false)
      setEditingUser(null)
      editForm.resetFields()
      // 重新加载用户列表以确保数据同步
      loadUsers()
    } catch (error: any) {
      console.error('更新用户错误:', error)
      message.error(error.response?.data?.message || '更新失败')
    }
  }

  const handleDeleteUser = (user: User) => {
    // 保护admin账号不被删除
    if (user.role === 'admin') {
      message.warning('管理员账号不允许删除')
      return
    }

    modal.confirm({
      title: '确认删除用户',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除用户 "${user.nickname || user.email}" 吗？此操作不可撤销。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await users.delete(user.id.toString())
          message.success('用户删除成功')
          loadUsers()
        } catch (error: any) {
          console.error('删除用户错误:', error)
          message.error(error.response?.data?.message || '删除失败')
        }
      }
    })
  }

  const handleToggleUserStatus = async (user: User) => {
    // 保护admin账号不被禁用
    if (user.role === 'admin' && user.status === 'active') {
      message.warning('管理员账号不允许禁用')
      return
    }

    const action = user.status === 'active' ? '禁用' : '启用'
    const newStatus = user.status === 'active' ? 'disabled' : 'active'
    
    modal.confirm({
      title: `确认${action}用户`,
      icon: <ExclamationCircleOutlined />,
      content: `确定要${action}用户 "${user.nickname || user.email}" 吗？`,
      okText: `确认${action}`,
      okType: user.status === 'active' ? 'danger' : 'primary',
      cancelText: '取消',
      onOk: async () => {
        try {
          await users.updateStatus(user.id.toString(), newStatus as 'active' | 'disabled')
          message.success(`用户${action}成功`)
          loadUsers()
        } catch (error: any) {
          console.error(`${action}用户错误:`, error)
          message.error(error.response?.data?.message || `${action}失败`)
        }
      }
    })
  }

  const handleResetPassword = (user: User) => {
    modal.confirm({
      title: '确认重置密码',
      icon: <ExclamationCircleOutlined />,
      content: `确定要重置用户 "${user.nickname || user.email}" 的密码吗？密码将重置为系统默认密码。`,
      okText: '确认重置',
      okType: 'primary',
      cancelText: '取消',
      onOk: async () => {
        try {
          await users.resetPassword(user.id.toString())
          message.success('密码重置成功')
        } catch (error: any) {
          console.error('重置密码错误:', error)
          message.error(error.response?.data?.message || '重置密码失败')
        }
      }
    })
  }

  const openEditModal = (user: User) => {
    setEditingUser(user)
    editForm.setFieldsValue({
      role: user.role,
      nickname: user.nickname || '',
      school: user.school || '',
      class_name: user.class_name || ''
    })
    setShowEditModal(true)
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return '管理员'
      case 'teacher': return '教师'
      case 'student': return '学生'
      default: return '未知'
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'red'
      case 'teacher': return 'blue'
      case 'student': return 'green'
      default: return 'default'
    }
  }

  const getRoleTag = (role: string) => (
    <Tag color={getRoleColor(role)}>
      {getRoleLabel(role)}
    </Tag>
  )

  const totalPages = Math.ceil(totalUsers / limit)

  // 定义表格列
  const columns = [
    {
      title: '用户信息',
      dataIndex: 'email',
      key: 'user',
      render: (email: string, record: User) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Avatar 
            size={40} 
            style={{ backgroundColor: '#1890ff', marginRight: '12px' }}
            icon={<UserOutlined />}
          >
            {record.nickname ? record.nickname.charAt(0).toUpperCase() : email.charAt(0).toUpperCase()}
          </Avatar>
          <div>
            <div style={{ fontWeight: 500 }}>{record.nickname || '未设置昵称'}</div>
            <div style={{ color: '#8c8c8c', fontSize: '12px' }}>{email}</div>
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
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status === 'active' ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '学校/班级',
      key: 'school',
      render: (record: User) => (
        <div>
          <div>{record.school || '未设置'}</div>
          <div style={{ color: '#8c8c8c', fontSize: '12px' }}>{record.class_name || '未设置'}</div>
        </div>
      ),
    },
    {
      title: '等级',
      key: 'level',
      render: (record: User) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Tag color="gold" icon={<StarOutlined />}>
            Lv.{record.level}
          </Tag>
          <Text type="secondary" style={{ marginLeft: '8px', fontSize: '12px' }}>
            {record.experience_points} XP
          </Text>
        </div>
      ),
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => (
        <Text style={{ fontSize: '12px' }}>
          {new Date(date).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (record: User) => {
        const menuItems = [
          {
            key: 'view',
            icon: <EyeOutlined />,
            label: '查看详情',
            onClick: () => loadUserDetail(record.id)
          },
          {
            key: 'edit',
            icon: <EditOutlined />,
            label: '编辑信息',
            onClick: () => openEditModal(record)
          },
          {
            key: 'reset-password',
            icon: <KeyOutlined />,
            label: '重置密码',
            onClick: () => handleResetPassword(record)
          },
          // 只有非admin账号或者admin账号处于禁用状态时才显示状态切换选项
          ...(record.role !== 'admin' || record.status === 'disabled' ? [{
            key: 'toggle-status',
            icon: <StopOutlined />,
            label: record.status === 'active' ? '禁用用户' : '启用用户',
            onClick: () => handleToggleUserStatus(record)
          }] : []),
          {
            type: 'divider'
          },
          // 只有非admin账号才显示删除选项
          ...(record.role !== 'admin' ? [{
            key: 'delete',
            icon: <DeleteOutlined />,
            label: '删除用户',
            danger: true,
            onClick: () => handleDeleteUser(record)
          }] : [])
        ].filter(item => item); // 过滤掉undefined项

        return (
          <Space>
            <Button 
              type="primary" 
              ghost 
              size="small" 
              icon={<EyeOutlined />}
              onClick={() => loadUserDetail(record.id)}
            >
              查看
            </Button>
            <Dropdown
              menu={{ items: menuItems }}
              trigger={['click']}
              placement="bottomRight"
            >
              <Button 
                type="default" 
                size="small" 
                icon={<MoreOutlined />}
              >
                更多
              </Button>
            </Dropdown>
          </Space>
        )
      },
    },
  ]

  // 只在初始加载且没有用户数据时显示全屏加载
  if (loading && users.length === 0 && currentPage === 1) {
    return <LoadingSpinner text="加载用户管理..." />
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: '24px' }}>
        <Title level={2} style={{ margin: 0 }}>用户管理</Title>
        <Paragraph type="secondary" style={{ margin: '8px 0 0 0' }}>管理系统用户和权限</Paragraph>
      </div>

      {/* 搜索和筛选 */}
      <Card style={{ marginBottom: '24px' }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={16}>
            <Search
              placeholder="搜索用户邮箱或昵称..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                // 非输入法状态下，立即触发搜索
                if (!isComposing.current) {
                  // 设置一个短暂的延迟，让React有时间更新状态
                  setTimeout(() => loadUsers(), 50);
                }
              }}
              // 添加onCompositionStart和onCompositionEnd事件处理中文输入法
              onCompositionStart={() => {
                // 标记正在使用输入法
                isComposing.current = true;
              }}
              onCompositionEnd={(e) => {
                // 输入法输入完成
                isComposing.current = false;
                // 确保搜索词是最终输入的值
                setSearchTerm(e.target.value);
                // 手动触发一次搜索
                setTimeout(() => loadUsers(), 50);
              }}
              onKeyDown={(e) => {
                // 当用户按下回车键时立即触发搜索
                if (e.key === 'Enter') {
                  loadUsers();
                }
              }}
              prefix={<SearchOutlined />}
              allowClear
              size="large"
              ref={searchInputRef}
              autoFocus
            />
          </Col>
          <Col xs={24} md={8}>
            <Space>
              <FilterOutlined style={{ color: '#8c8c8c' }} />
              <Select
                value={roleFilter}
                onChange={(value) => {
                  setRoleFilter(value)
                  setCurrentPage(1)
                }}
                style={{ width: 120 }}
                size="large"
                placeholder="选择角色"
              >
                <Option value="">所有角色</Option>
                <Option value="student">学生</Option>
                <Option value="teacher">教师</Option>
                <Option value="admin">管理员</Option>
              </Select>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 用户列表 */}
      <Card style={{ marginBottom: '24px' }}>
        <Table
          columns={columns}
          dataSource={userList}
          rowKey="id"
          loading={loading}
          pagination={false}
          locale={{
            emptyText: (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <Users size={48} style={{ color: '#d9d9d9', marginBottom: '16px' }} />
                <div style={{ fontSize: '16px', fontWeight: 500, marginBottom: '8px' }}>暂无用户数据</div>
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
            )
          }}
        />

        {/* 分页组件 */}
        <div style={{ textAlign: 'right', marginTop: '16px' }}>
          <Pagination
            {...createPaginationConfig({
              current: currentPage,
              total: totalUsers,
              pageSize: limit,
              onChange: setCurrentPage,
              onShowSizeChange: (current, newPageSize) => {
                setLimit(newPageSize)
                setCurrentPage(1) // 重置到第一页
              }
            })}
          />
        </div>
      </Card>

      {/* 用户详情模态框 */}
      <Modal
        title="用户详情"
        open={showDetailModal}
        onCancel={() => setShowDetailModal(false)}
        footer={[
          <Button key="edit" onClick={() => {
            setShowDetailModal(false)
            openEditModal(selectedUser!)
          }}>
            编辑用户
          </Button>,
          <Button key="close" type="primary" onClick={() => setShowDetailModal(false)}>
            关闭
          </Button>
        ]}
        width={800}
        style={{ top: 20 }}
      >
        {selectedUser && (
          <div>
            {/* 基本信息 */}
            <Title level={4}>基本信息</Title>
            <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
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
                  <div>
                    {new Date(selectedUser.created_at).toLocaleDateString('zh-CN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
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
            
            {/* 学习统计 */}
            <Title level={4}>学习统计</Title>
            <Row gutter={[16, 16]}>
              <Col span={12} md={8}>
                <Card>
                  <Statistic
                    title="等级"
                    value={selectedUser.level}
                    prefix={<StarOutlined style={{ color: '#faad14' }} />}
                    formatter={(value) => `Lv.${value}`}
                  />
                </Card>
              </Col>
              <Col span={12} md={8}>
                <Card>
                  <Statistic
                    title="经验值"
                    value={selectedUser.experience_points}
                    suffix="XP"
                  />
                </Card>
              </Col>
              <Col span={12} md={8}>
                <Card>
                  <Statistic
                    title="平均分数"
                    value={selectedUser.statistics.averageScore}
                    precision={1}
                  />
                </Card>
              </Col>
              <Col span={12} md={8}>
                <Card>
                  <Statistic
                    title="总提交次数"
                    value={selectedUser.statistics.totalSubmissions}
                  />
                </Card>
              </Col>
              <Col span={12} md={8}>
                <Card>
                  <Statistic
                    title="完成次数"
                    value={selectedUser.statistics.completedSubmissions}
                  />
                </Card>
              </Col>
            </Row>
          </div>
        )}
      </Modal>

      {/* 编辑用户模态框 */}
       <Modal
          title={<span><EditOutlined style={{ marginRight: 8 }} />编辑用户</span>}
          open={showEditModal}
          onCancel={() => {
            setShowEditModal(false)
            setEditingUser(null)
            editForm.resetFields()
          }}
          footer={null}
          width={600}
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
                class_name: editingUser.class_name
              }}
            >
             <Form.Item
               label="角色"
               name="role"
               rules={[{ required: true, message: '请选择用户角色' }]}
             >
               <Select placeholder="选择用户的系统角色">
                 <Option value="student">学生</Option>
                 <Option value="teacher">教师</Option>
                 <Option value="admin">管理员</Option>
               </Select>
             </Form.Item>
             
             <Form.Item
               label="昵称"
               name="nickname"
               rules={[
                 { required: true, message: '昵称不能为空' },
                 { max: 20, message: '昵称不能超过20个字符' }
               ]}
             >
               <Input placeholder="用户在系统中显示的名称" />
             </Form.Item>
             
             <Form.Item
               label="学校"
               name="school"
             >
               <Input placeholder="用户所属的学校名称" />
             </Form.Item>
             
             <Form.Item
               label="班级"
               name="class_name"
             >
               <Input placeholder="用户所属的班级名称" />
             </Form.Item>
             
             <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                <Space>
                  <Button onClick={() => {
                    setShowEditModal(false)
                    setEditingUser(null)
                    editForm.resetFields()
                  }}>
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
    </div>
  )
}

export default UserManagementPage