const mysql = require('mysql2/promise');
require('dotenv').config();

// 创建数据库连接
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

async function testUser2Permissions() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功');
    
    // 执行与getUserMenuPermissions相同的查询
    const [rows] = await connection.execute(
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
      [2, 2]
    );
    
    console.log(`\n找到 ${rows.length} 个菜单`);
    
    // 查找菜单ID为3和61的权限
    const menu3 = rows.find(r => r.menu_id === 3);
    const menu61 = rows.find(r => r.menu_id === 61);
    
    console.log('\n菜单ID为3的权限:', menu3);
    console.log('\n菜单ID为61的权限:', menu61);
    
    // 显示所有有权限的菜单
    const accessibleMenus = rows.filter(r => r.has_permission);
    console.log(`\n用户有权限的菜单数量: ${accessibleMenus.length}`);
    console.log('有权限的菜单ID:', accessibleMenus.map(m => m.menu_id));
    
  } catch (error) {
    console.error('查询失败:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

testUser2Permissions();