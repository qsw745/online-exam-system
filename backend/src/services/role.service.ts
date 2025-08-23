import { pool } from '../config/database.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import {
  Role,
  UserRole,
  RoleMenu,
  CreateRoleRequest,
  UpdateRoleRequest
} from '../models/menu.model.js';

export class RoleService {
  /**
   * 获取所有角色
   */
  static async getAllRoles(): Promise<Role[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM roles ORDER BY is_system DESC, created_at ASC'
    );
    return rows as Role[];
  }

  /**
   * 根据ID获取角色
   */
  static async getRoleById(id: number): Promise<Role | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM roles WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? (rows[0] as Role) : null;
  }

  /**
   * 创建角色
   */
  static async createRole(roleData: CreateRoleRequest): Promise<Role> {
    const { name, code, description, is_disabled = false } = roleData;
    
    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO roles (name, code, description, is_disabled) VALUES (?, ?, ?, ?)',
      [name, code, description, is_disabled]
    );
    
    const role = await this.getRoleById(result.insertId);
    if (!role) {
      throw new Error('创建角色失败');
    }
    
    return role;
  }

  /**
   * 更新角色
   */
  static async updateRole(id: number, roleData: UpdateRoleRequest): Promise<Role | null> {
    const role = await this.getRoleById(id);
    if (!role) {
      return null;
    }
    
    // 系统角色不允许修改某些字段
    if (role.is_system && (roleData.code || roleData.name)) {
      throw new Error('系统角色不允许修改名称和编码');
    }
    
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    
    if (roleData.name !== undefined && !role.is_system) {
      updateFields.push('name = ?');
      updateValues.push(roleData.name);
    }
    
    if (roleData.code !== undefined && !role.is_system) {
      updateFields.push('code = ?');
      updateValues.push(roleData.code);
    }
    
    if (roleData.description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(roleData.description);
    }
    
    if (roleData.is_disabled !== undefined) {
      updateFields.push('is_disabled = ?');
      updateValues.push(roleData.is_disabled);
    }
    
    if (updateFields.length === 0) {
      return role;
    }
    
    updateValues.push(id);
    
    await pool.execute(
      `UPDATE roles SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      updateValues
    );
    
    return await this.getRoleById(id);
  }

  /**
   * 删除角色
   */
  static async deleteRole(id: number): Promise<boolean> {
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

  /**
   * 获取角色的菜单权限
   */
  static async getRoleMenus(roleId: number): Promise<number[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT menu_id FROM role_menus WHERE role_id = ?',
      [roleId]
    );
    return rows.map(row => row.menu_id);
  }

  /**
   * 设置角色的菜单权限
   */
  static async setRoleMenus(roleId: number, menuIds: number[]): Promise<void> {
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
        const values = menuIds.map(menuId => [roleId, menuId]);
        await connection.execute(
          'INSERT INTO role_menus (role_id, menu_id) VALUES ?',
          [values]
        );
      }
      
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 获取用户的角色
   */
  static async getUserRoles(userId: number): Promise<Role[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT r.* FROM roles r 
       INNER JOIN user_roles ur ON r.id = ur.role_id 
       WHERE ur.user_id = ? 
       ORDER BY r.is_system DESC, r.created_at ASC`,
      [userId]
    );
    return rows as Role[];
  }

  /**
   * 设置用户的角色
   */
  static async setUserRoles(userId: number, roleIds: number[]): Promise<void> {
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
        const values = roleIds.map(roleId => [userId, roleId]);
        await connection.execute(
          'INSERT INTO user_roles (user_id, role_id) VALUES ?',
          [values]
        );
      }
      
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 检查用户是否拥有指定角色
   */
  static async userHasRole(userId: number, roleCode: string): Promise<boolean> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM user_roles ur 
       INNER JOIN roles r ON ur.role_id = r.id 
       WHERE ur.user_id = ? AND r.code = ? AND r.is_disabled = FALSE`,
      [userId, roleCode]
    );
    return rows[0].count > 0;
  }

  /**
   * 检查用户是否拥有任一指定角色
   */
  static async userHasAnyRole(userId: number, roleCodes: string[]): Promise<boolean> {
    if (roleCodes.length === 0) return false;
    
    const placeholders = roleCodes.map(() => '?').join(',');
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM user_roles ur 
       INNER JOIN roles r ON ur.role_id = r.id 
       WHERE ur.user_id = ? AND r.code IN (${placeholders}) AND r.is_disabled = FALSE`,
      [userId, ...roleCodes]
    );
    return rows[0].count > 0;
  }

  /**
   * 获取角色的用户列表
   */
  static async getRoleUsers(roleId: number): Promise<any[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT u.id, u.username, u.email, ur.created_at as assigned_at 
       FROM users u 
       INNER JOIN user_roles ur ON u.id = ur.user_id 
       WHERE ur.role_id = ? 
       ORDER BY ur.created_at DESC`,
      [roleId]
    );
    return rows;
  }
}