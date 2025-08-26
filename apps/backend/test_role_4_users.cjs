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

async function testGetRole4Users() {
  let connection;
  
  try {
    // 连接数据库
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功');
    
    // 测试获取角色ID为4的用户列表（模拟getRoleUsers API）
    const roleId = 4;
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
    
    // 验证API返回格式
    console.log('\nAPI返回格式预览:');
    console.log(JSON.stringify({
      success: true,
      data: users.slice(0, 3) // 只显示前3个用户
    }, null, 2));
    
  } catch (error) {
    console.error('测试失败:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

testGetRole4Users();