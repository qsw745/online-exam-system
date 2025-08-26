import { pool } from '../config/database.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import {
  Menu,
  Role,
  UserRole,
  RoleMenu,
  UserMenu,
  CreateMenuRequest,
  UpdateMenuRequest,
  CreateRoleRequest,
  UpdateRoleRequest,
  MenuTreeNode,
  UserMenuPermission
} from '../models/menu.model.js';

export class MenuService {
  // 获取所有菜单
  static async getAllMenus(): Promise<Menu[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM menus ORDER BY sort_order ASC, id ASC'
    );
    return rows as Menu[];
  }

  // 获取菜单树结构
  static async getMenuTree(): Promise<MenuTreeNode[]> {
    const menus = await this.getAllMenus();
    return this.buildMenuTree(menus);
  }

  // 构建菜单树
  private static buildMenuTree(menus: Menu[], parentId: number | null = null): MenuTreeNode[] {
    const tree: MenuTreeNode[] = [];
    
    for (const menu of menus) {
      if (menu.parent_id === parentId) {
        const node: MenuTreeNode = {
          ...menu,
          children: this.buildMenuTree(menus, menu.id)
        };
        tree.push(node);
      }
    }
    
    return tree.sort((a, b) => a.sort_order - b.sort_order);
  }

  // 根据ID获取菜单
  static async getMenuById(id: number): Promise<Menu | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM menus WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? rows[0] as Menu : null;
  }

  // 创建菜单
  static async createMenu(menuData: CreateMenuRequest): Promise<number> {
    const {
      name,
      title,
      path,
      component,
      icon,
      parent_id,
      sort_order = 0,
      is_hidden = false,
      is_disabled = false,
      menu_type = 'menu',
      permission_code,
      redirect,
      meta,
      description
    } = menuData;

    // 计算菜单层级
    let level = 1;
    if (parent_id) {
      const parentMenu = await this.getMenuById(parent_id);
      if (parentMenu) {
        level = parentMenu.level + 1;
      }
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO menus (
        name, title, path, component, icon, parent_id, sort_order, level,
        is_hidden, is_disabled, is_system, menu_type, permission_code,
        redirect, meta, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, title, path || null, component || null, icon || null, parent_id || null, sort_order, level,
        is_hidden, is_disabled, false, menu_type, permission_code || null,
        redirect || null, meta ? JSON.stringify(meta) : null, description || null
      ]
    );

    return result.insertId;
  }

  // 更新菜单
  static async updateMenu(menuData: UpdateMenuRequest): Promise<boolean> {
    const { id, ...updateData } = menuData;
    
    const fields = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updateData)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        if (key === 'meta' && value) {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
      }
    }
    
    if (fields.length === 0) {
      return false;
    }
    
    values.push(id);
    
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE menus SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    
    return result.affectedRows > 0;
  }

  // 删除菜单
  static async deleteMenu(id: number): Promise<boolean> {
    // 检查是否为系统菜单
    const menu = await this.getMenuById(id);
    if (!menu || menu.is_system) {
      return false;
    }

    // 检查是否有子菜单
    const [childRows] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM menus WHERE parent_id = ?',
      [id]
    );
    
    if (childRows[0].count > 0) {
      throw new Error('无法删除包含子菜单的菜单项');
    }

    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM menus WHERE id = ?',
      [id]
    );
    
    return result.affectedRows > 0;
  }

  // 批量更新菜单排序
  static async batchUpdateMenuSort(menuUpdates: Array<{id: number, sort_order: number, parent_id?: number}>): Promise<boolean> {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      for (const update of menuUpdates) {
        const { id, sort_order, parent_id } = update;
        
        if (parent_id !== undefined) {
          // 如果需要更新父级ID，同时更新排序和父级
          await connection.execute(
            'UPDATE menus SET sort_order = ?, parent_id = ? WHERE id = ?',
            [sort_order, parent_id, id]
          );
        } else {
          // 只更新排序
          await connection.execute(
            'UPDATE menus SET sort_order = ? WHERE id = ?',
            [sort_order, id]
          );
        }
      }
      
      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      console.error('批量更新菜单排序失败:', error);
      return false;
    } finally {
      connection.release();
    }
  }

  // 获取所有角色
  static async getAllRoles(): Promise<Role[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM roles ORDER BY sort_order ASC, id ASC'
    );
    return rows as Role[];
  }

  // 根据ID获取角色
  static async getRoleById(id: number): Promise<Role | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM roles WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? rows[0] as Role : null;
  }

  // 创建角色
  static async createRole(roleData: CreateRoleRequest): Promise<number> {
    const { name, description, sort_order } = roleData;
    
    // 如果没有指定排序号，则获取当前最大排序号+1
    let finalSortOrder = sort_order;
    if (finalSortOrder === undefined || finalSortOrder === null) {
      const [maxSortRows] = await pool.execute<RowDataPacket[]>(
        'SELECT MAX(sort_order) as max_sort FROM roles'
      );
      const maxSort = maxSortRows[0]?.max_sort || 0;
      finalSortOrder = maxSort + 1;
    }
    
    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO roles (name, description, sort_order, is_system, is_disabled) VALUES (?, ?, ?, ?, ?)',
      [name, description || null, finalSortOrder, false, false]
    );
    
    return result.insertId;
  }

  // 更新角色
  static async updateRole(roleData: UpdateRoleRequest): Promise<boolean> {
    const { id, ...updateData } = roleData;
    
    const fields = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updateData)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    
    if (fields.length === 0) {
      return false;
    }
    
    values.push(id);
    
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE roles SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    
    return result.affectedRows > 0;
  }

  // 删除角色
  static async deleteRole(id: number): Promise<boolean> {
    // 检查是否为系统角色
    const role = await this.getRoleById(id);
    if (!role) {
      return false;
    }
    
    // 系统角色不允许删除
    if (role.is_system) {
      throw new Error('系统角色不允许删除');
    }
    
    // 检查是否有用户使用此角色
    const [userRoles] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM user_roles WHERE role_id = ?',
      [id]
    );
    
    if (userRoles[0].count > 0) {
      throw new Error('该角色正在被用户使用，无法删除');
    }

    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM roles WHERE id = ?',
      [id]
    );
    
    return result.affectedRows > 0;
  }

  // 为角色分配菜单权限
  static async assignRoleMenus(roleId: number, menuIds: number[]): Promise<boolean> {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // 删除现有权限
      await connection.execute(
        'DELETE FROM role_menus WHERE role_id = ?',
        [roleId]
      );
      
      // 添加新权限
      if (menuIds.length > 0) {
        const placeholders = menuIds.map(() => '(?, ?)').join(', ');
        const values = menuIds.flatMap(menuId => [roleId, menuId]);
        await connection.execute(
          `INSERT INTO role_menus (role_id, menu_id) VALUES ${placeholders}`,
          values
        );
      }
      
      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // 获取角色的菜单权限
  static async getRoleMenus(roleId: number): Promise<number[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT menu_id FROM role_menus WHERE role_id = ?',
      [roleId]
    );
    return rows.map(row => row.menu_id);
  }

  // 为用户分配角色
  static async assignUserRoles(userId: number, roleIds: number[]): Promise<boolean> {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // 删除现有角色
      await connection.execute(
        'DELETE FROM user_roles WHERE user_id = ?',
        [userId]
      );
      
      // 添加新角色
      if (roleIds.length > 0) {
        const placeholders = roleIds.map(() => '(?, ?)').join(', ');
        const values = roleIds.flatMap(roleId => [userId, roleId]);
        await connection.execute(
          `INSERT INTO user_roles (user_id, role_id) VALUES ${placeholders}`,
          values
        );
      }
      
      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // 获取用户的角色
  static async getUserRoles(userId: number): Promise<Role[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT r.* FROM roles r 
       INNER JOIN user_roles ur ON r.id = ur.role_id 
       WHERE ur.user_id = ? AND r.is_disabled = FALSE`,
      [userId]
    );
    return rows as Role[];
  }

  // 获取用户的菜单权限
  static async getUserMenuPermissions(userId: number): Promise<UserMenuPermission[]> {
    // 首先检查用户是否为admin角色
    const [userInfo] = await pool.execute<RowDataPacket[]>(
      'SELECT role FROM users WHERE id = ?',
      [userId]
    );
    
    const isAdmin = userInfo.length > 0 && userInfo[0].role === 'admin';
    
    if (isAdmin) {
      // 如果是admin，返回所有菜单权限
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT DISTINCT 
           m.id as menu_id,
           m.name as menu_name,
           m.title as menu_title,
           m.path,
           m.component,
           m.icon,
           m.parent_id,
           m.sort_order,
           m.level,
           m.menu_type,
           m.permission_code,
           m.redirect,
           m.meta,
           TRUE as has_permission,
           'admin' as permission_source
         FROM menus m
         WHERE m.is_disabled = FALSE
         ORDER BY m.sort_order ASC, m.id ASC`
      );
      
      return rows.map(row => ({
        ...row,
        meta: row.meta ? (typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta) : null,
        has_permission: true
      })) as UserMenuPermission[];
    }
    
    // 非admin用户按原有逻辑处理
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT DISTINCT 
         m.id as menu_id,
         m.name as menu_name,
         m.title as menu_title,
         m.path,
         m.component,
         m.icon,
         m.parent_id,
         m.sort_order,
         m.level,
         m.menu_type,
         m.permission_code,
         m.redirect,
         m.meta,
         CASE 
           WHEN um.permission_type = 'deny' THEN FALSE
           WHEN um.permission_type = 'grant' THEN TRUE
           WHEN rm.menu_id IS NOT NULL THEN TRUE
           ELSE FALSE
         END as has_permission,
         CASE 
           WHEN um.permission_type = 'deny' THEN 'deny'
           WHEN um.permission_type = 'grant' THEN 'user'
           WHEN rm.menu_id IS NOT NULL THEN 'role'
           ELSE 'none'
         END as permission_source
       FROM menus m
       LEFT JOIN user_menus um ON m.id = um.menu_id AND um.user_id = ?
       LEFT JOIN (
         SELECT DISTINCT rm.menu_id
         FROM role_menus rm
         INNER JOIN user_roles ur ON rm.role_id = ur.role_id
         INNER JOIN roles r ON ur.role_id = r.id
         WHERE ur.user_id = ? AND r.is_disabled = FALSE
       ) rm ON m.id = rm.menu_id
       WHERE m.is_disabled = FALSE
       ORDER BY m.sort_order ASC, m.id ASC`,
      [userId, userId]
    );
    
    return rows.map(row => ({
      ...row,
      meta: row.meta ? (typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta) : null,
      has_permission: Boolean(row.has_permission)
    })) as UserMenuPermission[];
  }

  // 获取用户可访问的菜单树
  static async getUserMenuTree(userId: number): Promise<MenuTreeNode[]> {
    const permissions = await this.getUserMenuPermissions(userId);
    const accessibleMenus = permissions
      .filter(p => p.has_permission)
      .map(p => ({
        id: p.menu_id,
        name: p.menu_name,
        title: p.menu_title,
        path: p.path,
        component: p.component,
        icon: p.icon,
        parent_id: p.parent_id,
        sort_order: p.sort_order,
        level: p.level,
        is_hidden: false,
        is_disabled: false,
        is_system: false,
        menu_type: p.menu_type,
        permission_code: p.permission_code,
        redirect: p.redirect,
        meta: p.meta,
        created_at: '',
        updated_at: ''
      } as Menu));
    
    return this.buildMenuTree(accessibleMenus);
  }

  // 检查用户是否有特定菜单权限
  static async checkUserMenuPermission(userId: number, menuId: number): Promise<boolean> {
    // 首先检查用户是否为admin角色
    const [userInfo] = await pool.execute<RowDataPacket[]>(
      'SELECT role FROM users WHERE id = ?',
      [userId]
    );
    
    const isAdmin = userInfo.length > 0 && userInfo[0].role === 'admin';
    
    if (isAdmin) {
      // admin用户对所有启用的菜单都有权限
      const [menuExists] = await pool.execute<RowDataPacket[]>(
        'SELECT id FROM menus WHERE id = ? AND is_disabled = FALSE',
        [menuId]
      );
      return menuExists.length > 0;
    }
    
    // 非admin用户按原有逻辑处理
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
         CASE 
           WHEN um.permission_type = 'deny' THEN FALSE
           WHEN um.permission_type = 'grant' THEN TRUE
           WHEN rm.menu_id IS NOT NULL THEN TRUE
           ELSE FALSE
         END as has_permission
       FROM menus m
       LEFT JOIN user_menus um ON m.id = um.menu_id AND um.user_id = ?
       LEFT JOIN (
         SELECT DISTINCT rm.menu_id
         FROM role_menus rm
         INNER JOIN user_roles ur ON rm.role_id = ur.role_id
         INNER JOIN roles r ON ur.role_id = r.id
         WHERE ur.user_id = ? AND r.is_disabled = FALSE
       ) rm ON m.id = rm.menu_id
       WHERE m.id = ? AND m.is_disabled = FALSE`,
      [userId, userId, menuId]
    );
    
    return rows.length > 0 ? Boolean(rows[0].has_permission) : false;
  }

  // 为用户设置特定菜单权限
  static async setUserMenuPermission(userId: number, menuId: number, permissionType: 'grant' | 'deny'): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO user_menus (user_id, menu_id, permission_type) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE permission_type = VALUES(permission_type)`,
      [userId, menuId, permissionType]
    );
    
    return result.affectedRows > 0;
  }

  // 移除用户特定菜单权限
  static async removeUserMenuPermission(userId: number, menuId: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM user_menus WHERE user_id = ? AND menu_id = ?',
      [userId, menuId]
    );
    
    return result.affectedRows > 0;
  }
}