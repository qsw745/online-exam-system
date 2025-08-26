const mysql = require('mysql2/promise');
require('dotenv').config();

// 创建数据库连接
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

async function testRoleMenusAPI() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功');
    
    // 模拟新的getRoleMenus方法
    const roleId = 5;
    const [rows] = await connection.execute(
      `SELECT m.id, m.name, m.title, m.path, m.icon, m.parent_id, m.sort_order
       FROM role_menus rm
       JOIN menus m ON rm.menu_id = m.id
       WHERE rm.role_id = ?
       ORDER BY m.sort_order, m.id`,
      [roleId]
    );
    
    console.log(`角色ID ${roleId} 的菜单权限详细信息:`);
    console.log(JSON.stringify(rows, null, 2));
    
    console.log('\n=== API响应格式 ===');
    const apiResponse = {
      success: true,
      data: rows
    };
    console.log(JSON.stringify(apiResponse, null, 2));
    
  } catch (error) {
    console.error('测试失败:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

testRoleMenusAPI();