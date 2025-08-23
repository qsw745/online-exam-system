import React, { useState, useEffect } from 'react';
import { Card, Tree, Button, Modal, Form, Input, Select, Switch, message, Space, Popconfirm, Table, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SettingOutlined } from '@ant-design/icons';
import type { TreeDataNode } from 'antd/es/tree';
import { api } from '../../lib/api';

interface Menu {
  id: number;
  name: string;
  title: string;
  path?: string;
  component?: string;
  icon?: string;
  parent_id?: number;
  sort_order: number;
  level: number;
  is_hidden: boolean;
  is_disabled: boolean;
  is_system: boolean;
  menu_type: 'menu' | 'button' | 'page';
  permission_code?: string;
  redirect?: string;
  meta?: string;
  created_at: string;
  updated_at: string;
}

interface Role {
  id: number;
  name: string;
  code: string;
  description?: string;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

interface MenuFormData {
  name: string;
  title: string;
  path?: string;
  component?: string;
  icon?: string;
  parent_id?: number;
  sort_order: number;
  is_hidden: boolean;
  is_disabled: boolean;
  menu_type: 'menu' | 'button' | 'page';
  permission_code?: string;
  redirect?: string;
  meta?: string;
}

interface RoleFormData {
  name: string;
  code: string;
  description?: string;
}

const MenuManagementPage: React.FC = () => {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [treeData, setTreeData] = useState<TreeDataNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'menu' | 'role' | 'permission'>('menu');
  
  // 菜单相关状态
  const [menuModalVisible, setMenuModalVisible] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [menuForm] = Form.useForm();
  
  // 角色相关状态
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleForm] = Form.useForm();
  
  // 权限分配相关状态
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [roleMenuIds, setRoleMenuIds] = useState<number[]>([]);
  const [checkedKeys, setCheckedKeys] = useState<React.Key[]>([]);

  useEffect(() => {
    loadMenus();
    loadRoles();
  }, []);

  const loadMenus = async () => {
    try {
      setLoading(true);
      const response = await api.get('/menu/menus');
      if (response.data.success) {
        setMenus(response.data.data);
        buildTreeData(response.data);
      }
    } catch (error) {
      message.error('加载菜单失败');
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const response = await api.get('/menu/roles');
      if (response.data.success) {
        setRoles(response.data.data);
      }
    } catch (error) {
      message.error('加载角色失败');
    }
  };

  const buildTreeData = (menuList: Menu[]): void => {
    const menuMap = new Map<number, Menu>();
    menuList.forEach(menu => menuMap.set(menu.id, menu));

    const buildNode = (menu: Menu): TreeDataNode => ({
      key: menu.id,
      title: (
        <div className="flex items-center justify-between w-full">
          <span className="flex items-center">
            {menu.icon && <span className={`mr-2 ${menu.icon}`} />}
            <span>{menu.title}</span>
            <Tag color={menu.menu_type === 'menu' ? 'blue' : menu.menu_type === 'button' ? 'green' : 'orange'} className="ml-2">
              {menu.menu_type === 'menu' ? '菜单' : menu.menu_type === 'button' ? '按钮' : '页面'}
            </Tag>
            {menu.is_hidden && <Tag color="red">隐藏</Tag>}
            {menu.is_disabled && <Tag color="gray">禁用</Tag>}
          </span>
          <Space>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleEditMenu(menu);
              }}
            />
            {!menu.is_system && (
              <Popconfirm
                title="确定删除此菜单吗？"
                onConfirm={(e) => {
                  e?.stopPropagation();
                  handleDeleteMenu(menu.id);
                }}
                onClick={(e) => e?.stopPropagation()}
              >
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={(e) => e.stopPropagation()}
                />
              </Popconfirm>
            )}
          </Space>
        </div>
      ),
      children: menuList
        .filter(child => child.parent_id === menu.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(child => buildNode(child))
    });

    const rootMenus = menuList
      .filter(menu => !menu.parent_id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(menu => buildNode(menu));

    setTreeData(rootMenus);
  };

  const handleCreateMenu = () => {
    setEditingMenu(null);
    menuForm.resetFields();
    setMenuModalVisible(true);
  };

  const handleEditMenu = (menu: Menu) => {
    setEditingMenu(menu);
    menuForm.setFieldsValue({
      ...menu,
      meta: menu.meta ? JSON.stringify(JSON.parse(menu.meta), null, 2) : ''
    });
    setMenuModalVisible(true);
  };

  const handleDeleteMenu = async (menuId: number) => {
    try {
      const response = await api.delete(`/menu/menus/${menuId}`);
      if (response.data.success) {
        message.success('删除成功');
        loadMenus();
      } else {
        message.error(response.data.message || '删除失败');
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleMenuSubmit = async () => {
    try {
      const values = await menuForm.validateFields();
      const formData: MenuFormData = {
        ...values,
        meta: values.meta ? JSON.stringify(JSON.parse(values.meta)) : undefined
      };

      let response;
      if (editingMenu) {
        response = await api.put(`/menu/menus/${editingMenu.id}`, formData);
      } else {
        response = await api.post('/menu/menus', formData);
      }

      if (response.data.success) {
        message.success(editingMenu ? '更新成功' : '创建成功');
        setMenuModalVisible(false);
        loadMenus();
      } else {
        message.error(response.data.message || '操作失败');
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleCreateRole = () => {
    setEditingRole(null);
    roleForm.resetFields();
    setRoleModalVisible(true);
  };

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    roleForm.setFieldsValue(role);
    setRoleModalVisible(true);
  };

  const handleDeleteRole = async (roleId: number) => {
    try {
      const response = await api.delete(`/menu/roles/${roleId}`);
      if (response.data.success) {
        message.success('删除成功');
        loadRoles();
      } else {
        message.error(response.data.message || '删除失败');
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleRoleSubmit = async () => {
    try {
      const values = await roleForm.validateFields();
      const formData: RoleFormData = values;

      let response;
      if (editingRole) {
        response = await api.put(`/menu/roles/${editingRole.id}`, formData);
      } else {
        response = await api.post('/menu/roles', formData);
      }

      if (response.data.success) {
        message.success(editingRole ? '更新成功' : '创建成功');
        setRoleModalVisible(false);
        loadRoles();
      } else {
        message.error(response.data.message || '操作失败');
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleAssignPermission = async (role: Role) => {
    setSelectedRole(role);
    try {
      const response = await api.get(`/menu/roles/${role.id}/menus`);
      if (response.data.success) {
        setRoleMenuIds(response.data.data);
        setCheckedKeys(response.data.data);
      }
    } catch (error) {
      message.error('加载角色权限失败');
    }
    setPermissionModalVisible(true);
  };

  const handlePermissionSubmit = async () => {
    if (!selectedRole) return;

    try {
      const response = await api.post(`/menu/roles/${selectedRole.id}/menus`, {
        menuIds: checkedKeys
      });

      if (response.data.success) {
        message.success('权限分配成功');
        setPermissionModalVisible(false);
      } else {
        message.error(response.data.message || '权限分配失败');
      }
    } catch (error) {
      message.error('权限分配失败');
    }
  };

  const roleColumns = [
    {
      title: '角色名称',
      dataIndex: 'name',
      key: 'name',
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
    },
    {
      title: '系统角色',
      dataIndex: 'is_system',
      key: 'is_system',
      render: (isSystem: boolean) => (
        <Tag color={isSystem ? 'red' : 'green'}>
          {isSystem ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Role) => (
        <Space>
          <Button
            type="link"
            icon={<SettingOutlined />}
            onClick={() => handleAssignPermission(record)}
          >
            分配权限
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditRole(record)}
          >
            编辑
          </Button>
          {!record.is_system && (
            <Popconfirm
              title="确定删除此角色吗？"
              onConfirm={() => handleDeleteRole(record.id)}
            >
              <Button type="link" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const renderMenuTab = () => (
    <Card
      title="菜单管理"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateMenu}>
          新增菜单
        </Button>
      }
    >
      <Tree
        treeData={treeData}
        defaultExpandAll
        showLine
        loading={loading}
      />
    </Card>
  );

  const renderRoleTab = () => (
    <Card
      title="角色管理"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateRole}>
          新增角色
        </Button>
      }
    >
      <Table
        columns={roleColumns}
        dataSource={roles}
        rowKey="id"
        loading={loading}
      />
    </Card>
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <Space>
          <Button
            type={activeTab === 'menu' ? 'primary' : 'default'}
            onClick={() => setActiveTab('menu')}
          >
            菜单管理
          </Button>
          <Button
            type={activeTab === 'role' ? 'primary' : 'default'}
            onClick={() => setActiveTab('role')}
          >
            角色管理
          </Button>
        </Space>
      </div>

      {activeTab === 'menu' && renderMenuTab()}
      {activeTab === 'role' && renderRoleTab()}

      {/* 菜单编辑模态框 */}
      <Modal
        title={editingMenu ? '编辑菜单' : '新增菜单'}
        open={menuModalVisible}
        onOk={handleMenuSubmit}
        onCancel={() => setMenuModalVisible(false)}
        width={600}
      >
        <Form form={menuForm} layout="vertical">
          <Form.Item
            name="name"
            label="菜单名称"
            rules={[{ required: true, message: '请输入菜单名称' }]}
          >
            <Input placeholder="请输入菜单名称" />
          </Form.Item>
          
          <Form.Item
            name="title"
            label="菜单标题"
            rules={[{ required: true, message: '请输入菜单标题' }]}
          >
            <Input placeholder="请输入菜单标题" />
          </Form.Item>
          
          <Form.Item name="path" label="路由路径">
            <Input placeholder="请输入路由路径" />
          </Form.Item>
          
          <Form.Item name="component" label="组件路径">
            <Input placeholder="请输入组件路径" />
          </Form.Item>
          
          <Form.Item name="icon" label="图标">
            <Input placeholder="请输入图标类名" />
          </Form.Item>
          
          <Form.Item name="parent_id" label="父级菜单">
            <Select placeholder="请选择父级菜单" allowClear>
              {menus
                .filter(menu => menu.menu_type === 'menu')
                .map(menu => (
                  <Select.Option key={menu.id} value={menu.id}>
                    {menu.title}
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="menu_type"
            label="菜单类型"
            rules={[{ required: true, message: '请选择菜单类型' }]}
            initialValue="menu"
          >
            <Select>
              <Select.Option value="menu">菜单</Select.Option>
              <Select.Option value="button">按钮</Select.Option>
              <Select.Option value="page">页面</Select.Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            name="sort_order"
            label="排序"
            rules={[{ required: true, message: '请输入排序值' }]}
            initialValue={0}
          >
            <Input type="number" placeholder="请输入排序值" />
          </Form.Item>
          
          <Form.Item name="permission_code" label="权限编码">
            <Input placeholder="请输入权限编码" />
          </Form.Item>
          
          <Form.Item name="redirect" label="重定向路径">
            <Input placeholder="请输入重定向路径" />
          </Form.Item>
          
          <Form.Item name="meta" label="元数据(JSON)">
            <Input.TextArea rows={3} placeholder="请输入JSON格式的元数据" />
          </Form.Item>
          
          <Form.Item name="is_hidden" valuePropName="checked" initialValue={false}>
            <Switch checkedChildren="隐藏" unCheckedChildren="显示" />
          </Form.Item>
          
          <Form.Item name="is_disabled" valuePropName="checked" initialValue={false}>
            <Switch checkedChildren="禁用" unCheckedChildren="启用" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 角色编辑模态框 */}
      <Modal
        title={editingRole ? '编辑角色' : '新增角色'}
        open={roleModalVisible}
        onOk={handleRoleSubmit}
        onCancel={() => setRoleModalVisible(false)}
      >
        <Form form={roleForm} layout="vertical">
          <Form.Item
            name="name"
            label="角色名称"
            rules={[{ required: true, message: '请输入角色名称' }]}
          >
            <Input placeholder="请输入角色名称" />
          </Form.Item>
          
          <Form.Item
            name="code"
            label="角色编码"
            rules={[{ required: true, message: '请输入角色编码' }]}
          >
            <Input placeholder="请输入角色编码" />
          </Form.Item>
          
          <Form.Item name="description" label="角色描述">
            <Input.TextArea rows={3} placeholder="请输入角色描述" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 权限分配模态框 */}
      <Modal
        title={`为角色 "${selectedRole?.name}" 分配菜单权限`}
        open={permissionModalVisible}
        onOk={handlePermissionSubmit}
        onCancel={() => setPermissionModalVisible(false)}
        width={600}
      >
        <Tree
          checkable
          treeData={treeData}
          checkedKeys={checkedKeys}
          onCheck={(checked) => setCheckedKeys(checked as React.Key[])}
          defaultExpandAll
        />
      </Modal>
    </div>
  );
};

export default MenuManagementPage;