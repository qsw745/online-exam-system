import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Select,
  App,
  Space,
  Tag,
  Card,
  Input,
  Avatar
} from 'antd';
import { Pagination } from 'antd';
import { createPaginationConfig } from '../../constants/pagination';
import {
  UserOutlined,
  SettingOutlined,
  SearchOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api } from '../../lib/api';

interface User {
  id: number;
  username: string;
  email: string;
  role: string; // 旧的角色字段
  created_at: string;
}

interface Role {
  id: number;
  name: string;
  code: string;
  description: string;
  is_system: boolean;
  is_disabled: boolean;
}

interface UserWithRoles extends User {
  roles: Role[];
}

const UserRoleManagementPage: React.FC = () => {
  const { message } = App.useApp();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const [searchText, setSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [form] = Form.useForm();

  // 加载用户列表
  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users');
      if (response.data.success) {
        const usersData = response.data.data;
        
        // 为每个用户加载角色信息
        const usersWithRoles = await Promise.all(
          usersData.map(async (user: User) => {
            try {
              const roleResponse = await api.get(`/roles/users/${user.id}/roles`);
              return {
                ...user,
                roles: roleResponse.data.success ? roleResponse.data : []
              };
            } catch (error) {
              return {
                ...user,
                roles: []
              };
            }
          })
        );
        
        setUsers(usersWithRoles);
      }
    } catch (error) {
      message.error('加载用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载角色列表
  const loadRoles = async () => {
    try {
      const response = await api.get('/roles');
      if (response.data) {
        setRoles(response.data.filter((role: Role) => !role.is_disabled));
      }
    } catch (error) {
      message.error('加载角色列表失败');
    }
  };

  useEffect(() => {
    loadUsers();
    loadRoles();
  }, []);

  // 打开角色分配弹窗
  const openRoleModal = (user: UserWithRoles) => {
    setSelectedUser(user);
    setSelectedRoleIds(user.roles.map(role => role.id));
    setModalVisible(true);
  };

  // 保存用户角色
  const handleSaveRoles = async () => {
    if (!selectedUser) return;

    try {
      const response = await api.put(`/roles/users/${selectedUser.id}/roles`, {
        roleIds: selectedRoleIds
      });
      if (response.data.success) {
        message.success('用户角色设置成功');
        setModalVisible(false);
        loadUsers(); // 重新加载用户列表
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '角色设置失败');
    }
  };

  // 获取角色标签颜色
  const getRoleTagColor = (roleCode: string) => {
    const colorMap: { [key: string]: string } = {
      'super_admin': 'red',
      'admin': 'orange',
      'teacher': 'blue',
      'student': 'green'
    };
    return colorMap[roleCode] || 'default';
  };

  // 过滤用户
  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(searchText.toLowerCase()) ||
    user.email.toLowerCase().includes(searchText.toLowerCase())
  );

  // 分页处理函数
  const handlePageChange = (page: number, size?: number) => {
    setCurrentPage(page);
    if (size && size !== pageSize) {
      setPageSize(size);
      setCurrentPage(1);
    }
  };

  const handlePageSizeChange = (current: number, size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  // 获取当前页数据
  const getCurrentPageUsers = () => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredUsers.slice(startIndex, endIndex);
  };

  // 表格列定义
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
      )
    },
    {
      title: '当前角色',
      key: 'roles',
      render: (_, record) => (
        <Space wrap>
          {record.roles.length > 0 ? (
            record.roles.map(role => (
              <Tag key={role.id} color={getRoleTagColor(role.code)}>
                {role.name}
              </Tag>
            ))
          ) : (
            <Tag color="default">未分配角色</Tag>
          )}
        </Space>
      )
    },
    {
      title: '旧角色字段',
      dataIndex: 'role',
      key: 'old_role',
      render: (text) => (
        <Tag color="gray">{text}</Tag>
      )
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text) => new Date(text).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button
          type="link"
          icon={<SettingOutlined />}
          onClick={() => openRoleModal(record)}
        >
          分配角色
        </Button>
      )
    }
  ];

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
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 300 }}
            />
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={getCurrentPageUsers()}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
        <Pagination
          current={currentPage}
          total={filteredUsers.length}
          pageSize={pageSize}
          onChange={handlePageChange}
          onShowSizeChange={handlePageSizeChange}
          {...createPaginationConfig()}
        />
      </Card>

      {/* 角色分配弹窗 */}
      <Modal
        title={`分配角色 - ${selectedUser?.username}`}
        open={modalVisible}
        onOk={handleSaveRoles}
        onCancel={() => setModalVisible(false)}
        width={600}
        okText="保存"
        cancelText="取消"
        destroyOnHidden={true}
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
                  style={{ width: '100%' }}
                >
                  {roles.map(role => (
                    <Select.Option key={role.id} value={role.id}>
                      <Space>
                        <Tag color={getRoleTagColor(role.code)}>{role.name}</Tag>
                        <span className="text-gray-500">({role.code})</span>
                      </Space>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
              
              <div className="text-sm text-gray-500">
                <p>当前角色：</p>
                <Space wrap className="mt-1">
                  {selectedUser.roles.length > 0 ? (
                    selectedUser.roles.map(role => (
                      <Tag key={role.id} color={getRoleTagColor(role.code)}>
                        {role.name}
                      </Tag>
                    ))
                  ) : (
                    <Tag color="default">未分配角色</Tag>
                  )}
                </Space>
              </div>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default UserRoleManagementPage;