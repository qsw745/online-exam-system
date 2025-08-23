import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Switch,
  message,
  Popconfirm,
  Space,
  Tag,
  Tree,
  Card,
  Row,
  Col,
  Descriptions
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SettingOutlined,
  UserOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { DataNode } from 'antd/es/tree';
import { api } from '../../lib/api';

interface Role {
  id: number;
  name: string;
  code: string;
  description: string;
  is_system: boolean;
  is_disabled: boolean;
  created_at: string;
  updated_at: string;
}

interface MenuItem {
  id: number;
  name: string;
  title: string;
  path?: string;
  icon?: string;
  parent_id?: number;
  children?: MenuItem[];
}

const RoleManagementPage: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedMenuIds, setSelectedMenuIds] = useState<number[]>([]);
  const [form] = Form.useForm();

  // 加载角色列表
  const loadRoles = async () => {
    try {
      setLoading(true);
      const response = await api.get('/roles');
      if (response.data.success) {
        setRoles(response.data.data);
      }
    } catch (error) {
      message.error('加载角色列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载菜单列表
  const loadMenus = async () => {
    try {
      const response = await api.get('/menu');
      if (response.data.success) {
        setMenus(response.data.data);
      }
    } catch (error) {
      message.error('加载菜单列表失败');
    }
  };

  // 加载角色菜单权限
  const loadRoleMenus = async (roleId: number) => {
    try {
      const response = await api.get(`/roles/${roleId}/menus`);
      if (response.data.success) {
        setSelectedMenuIds(response.data.data);
      }
    } catch (error) {
      message.error('加载角色权限失败');
    }
  };

  useEffect(() => {
    loadRoles();
    loadMenus();
  }, []);

  // 将菜单列表转换为树形结构
  const buildMenuTree = (menuList: MenuItem[]): DataNode[] => {
    const menuMap = new Map<number, MenuItem & { children: MenuItem[] }>();
    const rootMenus: (MenuItem & { children: MenuItem[] })[] = [];

    // 初始化所有菜单项
    menuList.forEach(menu => {
      menuMap.set(menu.id, { ...menu, children: [] });
    });

    // 构建树形结构
    menuList.forEach(menu => {
      const menuItem = menuMap.get(menu.id)!;
      if (menu.parent_id && menuMap.has(menu.parent_id)) {
        menuMap.get(menu.parent_id)!.children.push(menuItem);
      } else {
        rootMenus.push(menuItem);
      }
    });

    // 转换为 Tree 组件需要的格式
    const convertToTreeData = (items: (MenuItem & { children: MenuItem[] })[]): DataNode[] => {
      return items.map(item => ({
        key: item.id,
        title: item.title,
        children: item.children.length > 0 ? convertToTreeData(item.children) : undefined
      }));
    };

    return convertToTreeData(rootMenus);
  };

  // 处理角色表单提交
  const handleSubmit = async (values: any) => {
    try {
      if (editingRole) {
        // 更新角色
        const response = await api.put(`/roles/${editingRole.id}`, values);
        if (response.data.success) {
          message.success('角色更新成功');
          loadRoles();
        }
      } else {
        // 创建角色
        const response = await api.post('/roles', values);
        if (response.data.success) {
          message.success('角色创建成功');
          loadRoles();
        }
      }
      setModalVisible(false);
      setEditingRole(null);
      form.resetFields();
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  // 删除角色
  const handleDelete = async (role: Role) => {
    try {
      const response = await api.delete(`/roles/${role.id}`);
      if (response.data.success) {
        message.success('角色删除成功');
        loadRoles();
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '删除失败');
    }
  };

  // 保存角色权限
  const handleSavePermissions = async () => {
    if (!selectedRole) return;

    try {
      const response = await api.put(`/roles/${selectedRole.id}/menus`, {
        menuIds: selectedMenuIds
      });
      if (response.data.success) {
        message.success('权限设置成功');
        setPermissionModalVisible(false);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '权限设置失败');
    }
  };

  // 打开权限设置弹窗
  const openPermissionModal = async (role: Role) => {
    setSelectedRole(role);
    await loadRoleMenus(role.id);
    setPermissionModalVisible(true);
  };

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
      )
    },
    {
      title: '角色编码',
      dataIndex: 'code',
      key: 'code'
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text) => new Date(text).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingRole(record);
              form.setFieldsValue(record);
              setModalVisible(true);
            }}
          >
            编辑
          </Button>
          <Button
            type="link"
            icon={<SettingOutlined />}
            onClick={() => openPermissionModal(record)}
          >
            权限设置
          </Button>
          {!record.is_system && (
            <Popconfirm
              title="确定要删除这个角色吗？"
              onConfirm={() => handleDelete(record)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
              >
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  return (
    <div className="p-6">
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">角色管理</h1>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingRole(null);
              form.resetFields();
              setModalVisible(true);
            }}
          >
            新建角色
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={roles}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
        />
      </Card>

      {/* 角色编辑弹窗 */}
      <Modal
        title={editingRole ? '编辑角色' : '新建角色'}
        open={modalVisible}
        onOk={() => form.submit()}
        onCancel={() => {
          setModalVisible(false);
          setEditingRole(null);
          form.resetFields();
        }}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="角色名称"
                name="name"
                rules={[
                  { required: true, message: '请输入角色名称' },
                  { max: 50, message: '角色名称不能超过50个字符' }
                ]}
              >
                <Input placeholder="请输入角色名称" disabled={editingRole?.is_system} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="角色编码"
                name="code"
                rules={[
                  { required: true, message: '请输入角色编码' },
                  { max: 50, message: '角色编码不能超过50个字符' },
                  { pattern: /^[a-zA-Z0-9_]+$/, message: '角色编码只能包含字母、数字和下划线' }
                ]}
              >
                <Input placeholder="请输入角色编码" disabled={editingRole?.is_system} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            label="角色描述"
            name="description"
            rules={[
              { max: 500, message: '角色描述不能超过500个字符' }
            ]}
          >
            <Input.TextArea
              placeholder="请输入角色描述"
              rows={3}
            />
          </Form.Item>
          <Form.Item
            label="状态"
            name="is_disabled"
            valuePropName="checked"
          >
            <Switch
              checkedChildren="禁用"
              unCheckedChildren="启用"
            />
          </Form.Item>
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
              <h3 className="text-lg font-medium mb-3">菜单权限</h3>
              <Tree
                checkable
                checkedKeys={selectedMenuIds}
                onCheck={(checkedKeys) => {
                  setSelectedMenuIds(checkedKeys as number[]);
                }}
                treeData={buildMenuTree(menus)}
                height={400}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default RoleManagementPage;