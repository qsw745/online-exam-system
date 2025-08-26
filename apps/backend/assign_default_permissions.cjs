const mysql = require('mysql2/promise');
require('dotenv').config();

// 创建数据库连接
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

async function assignDefaultPermissions() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功');
    
    // 获取所有菜单ID
    const [menus] = await connection.execute('SELECT id FROM menus ORDER BY id');
    const menuIds = menus.map(menu => menu.id);
    console.log('可用菜单ID:', menuIds);
    
    // 获取所有角色
    const [roles] = await connection.execute('SELECT id, name FROM roles ORDER BY id');
    console.log('可用角色:', roles);
    
    // 为每个角色分配一些基础菜单权限
    for (const role of roles) {
      console.log(`\n为角色 ${role.name} (ID: ${role.id}) 分配权限...`);
      
      // 先清除现有权限
      await connection.execute('DELETE FROM role_menus WHERE role_id = ?', [role.id]);
      
      let assignedMenus = [];
      
      if (role.id === 1) {
        // 超级管理员 - 分配所有菜单权限
        assignedMenus = menuIds;
      } else if (role.id === 2) {
        // 管理员 - 分配大部分菜单权限（除了系统菜单管理）
        assignedMenus = menuIds.slice(0, Math.floor(menuIds.length * 0.8));
      } else if (role.id === 3) {
        // 教师 - 分配教学相关菜单权限
        assignedMenus = menuIds.slice(0, Math.floor(menuIds.length * 0.6));
      } else if (role.id === 4) {
        // 学生 - 分配基础菜单权限
        assignedMenus = menuIds.slice(0, Math.floor(menuIds.length * 0.4));
      } else if (role.id === 5) {
        // 普通用户 - 分配最基础的菜单权限
        assignedMenus = menuIds.slice(0, Math.floor(menuIds.length * 0.3));
      }
      
      // 插入权限分配
      for (const menuId of assignedMenus) {
        await connection.execute(
          'INSERT INTO role_menus (role_id, menu_id) VALUES (?, ?)',
          [role.id, menuId]
        );
      }
      
      console.log(`已为角色 ${role.name} 分配 ${assignedMenus.length} 个菜单权限`);
    }
    
    console.log('\n=== 权限分配完成，验证结果 ===');
    
    // 验证权限分配结果
    for (const role of roles) {
      const [roleMenus] = await connection.execute(
        'SELECT COUNT(*) as count FROM role_menus WHERE role_id = ?',
        [role.id]
      );
      console.log(`角色 ${role.name} (ID: ${role.id}) 拥有 ${roleMenus[0].count} 个菜单权限`);
    }
    
  } catch (error) {
    console.error('分配权限失败:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

assignDefaultPermissions();