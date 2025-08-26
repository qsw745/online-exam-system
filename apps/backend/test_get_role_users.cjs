const mysql = require('mysql2/promise');

// 加载环境变量
require('dotenv').config();

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4'
};

async function testGetRoleUsers() {
  let connection;
  
  try {
    // 连接数据库
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功');
    
    // 测试获取角色ID为5的用户列表
    const roleId = 5;
    console.log(`\n测试获取角色ID为${roleId}的用户列表:`);
    
    const [users] = await connection.execute(`
      SELECT 
        u.id,
        u.username,
        u.email,
        ur.created_at as assigned_at
      FROM users u
      INNER JOIN user_roles ur ON u.id = ur.user_id
      WHERE ur.role_id = ?
      ORDER BY ur.created_at DESC
    `, [roleId]);
    
    console.log(`找到 ${users.length} 个用户:`);
    users.forEach((user, index) => {
      console.log(`${index + 1}. ID: ${user.id}, 用户名: ${user.username}, 邮箱: ${user.email}, 分配时间: ${user.assigned_at}`);
    });
    
    // 如果没有用户，检查是否有用户数据
    if (users.length === 0) {
      console.log('\n检查是否有用户数据:');
      const [allUsers] = await connection.execute('SELECT id, username, email FROM users LIMIT 5');
      console.log(`系统中共有 ${allUsers.length} 个用户（显示前5个）:`);
      allUsers.forEach((user, index) => {
        console.log(`${index + 1}. ID: ${user.id}, 用户名: ${user.username}, 邮箱: ${user.email}`);
      });
      
      console.log('\n检查user_roles表:');
      const [userRoles] = await connection.execute('SELECT user_id, role_id, created_at FROM user_roles LIMIT 10');
      console.log(`user_roles表中共有 ${userRoles.length} 条记录（显示前10条）:`);
      userRoles.forEach((ur, index) => {
        console.log(`${index + 1}. 用户ID: ${ur.user_id}, 角色ID: ${ur.role_id}, 创建时间: ${ur.created_at}`);
      });
    }
    
  } catch (error) {
    console.error('测试失败:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

testGetRoleUsers();