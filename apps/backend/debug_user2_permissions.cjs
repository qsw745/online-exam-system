const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'exam_system'
};

async function debugUser2Permissions() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功');
    
    const userId = 2;
    console.log(`\n=== 调试用户ID ${userId} 的权限问题 ===`);
    
    // 1. 检查用户基本信息
    const [userInfo] = await connection.execute(
      'SELECT id, username, role FROM users WHERE id = ?',
      [userId]
    );
    
    console.log('1. 用户基本信息:', userInfo[0]);
    
    // 2. 检查admin判断逻辑
    const isAdmin = userInfo.length > 0 && userInfo[0].role === 'admin';
    console.log('2. 是否被判断为admin:', isAdmin);
    
    // 3. 如果不是admin，执行非admin查询
    if (!isAdmin) {
      console.log('\n3. 执行非admin用户查询...');
      
      const [rows] = await connection.execute(
        `SELECT DISTINCT 
           m.id as menu_id,
           m.name as menu_name,
           m.title as menu_title,
           m.sort_order,
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
      
      console.log('查询结果总数:', rows.length);
      
      const hasPermissionMenus = rows.filter(r => r.has_permission);
      console.log('有权限的菜单数:', hasPermissionMenus.length);
      
      // 统计权限来源
      const sources = {};
      hasPermissionMenus.forEach(r => {
        sources[r.permission_source] = (sources[r.permission_source] || 0) + 1;
      });
      console.log('权限来源统计:', sources);
      
      // 显示前10个有权限的菜单
      console.log('\n前10个有权限的菜单:');
      hasPermissionMenus.slice(0, 10).forEach(menu => {
        console.log(`  [${menu.menu_id}] ${menu.menu_title || menu.menu_name} - ${menu.permission_source}`);
      });
      
      // 检查是否有user_menus表中的直接权限
      const [userMenus] = await connection.execute(
        'SELECT * FROM user_menus WHERE user_id = ?',
        [userId]
      );
      console.log('\n4. 用户直接菜单权限数量:', userMenus.length);
      if (userMenus.length > 0) {
        console.log('用户直接菜单权限:', userMenus);
      }
      
    } else {
      console.log('\n3. 用户是admin，会返回所有菜单');
    }
    
  } catch (error) {
    console.error('调试失败:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

debugUser2Permissions();