const mysql = require('mysql2/promise');
require('dotenv').config();

// 创建数据库连接
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

async function assignParentMenu3ToAdmin() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功');
    
    // 检查管理员角色当前的菜单权限
    const [currentMenus] = await connection.execute(
      'SELECT menu_id FROM role_menus WHERE role_id = 2 ORDER BY menu_id'
    );
    console.log('管理员角色当前菜单权限:', currentMenus.map(m => m.menu_id));
    
    // 为管理员角色分配菜单ID 3的权限（题库管理父菜单）
    await connection.execute(
      'INSERT INTO role_menus (role_id, menu_id) VALUES (2, 3) ON DUPLICATE KEY UPDATE role_id = role_id'
    );
    
    console.log('已为管理员角色(ID:2)分配父菜单权限(ID:3)');
    
    // 验证权限分配结果
    const [updatedMenus] = await connection.execute(
      'SELECT menu_id FROM role_menus WHERE role_id = 2 ORDER BY menu_id'
    );
    console.log('更新后的菜单权限:', updatedMenus.map(m => m.menu_id));
    
  } catch (error) {
    console.error('分配权限失败:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

assignParentMenu3ToAdmin();