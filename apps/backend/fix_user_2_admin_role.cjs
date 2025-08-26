const mysql = require('mysql2/promise');
require('dotenv').config();

// 创建数据库连接
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

async function fixUser2AdminRole() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功');
    
    // 查询当前用户ID为2的角色
    const [currentRoles] = await connection.execute(
      'SELECT ur.user_id, ur.role_id, r.name as role_name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = 2'
    );
    
    console.log('用户ID为2当前角色:', currentRoles);
    
    // 更新用户ID为2的角色为管理员（role_id: 2）
    await connection.execute(
      'UPDATE user_roles SET role_id = 2 WHERE user_id = 2'
    );
    
    console.log('已将用户ID为2的角色更新为管理员(role_id: 2)');
    
    // 验证更新结果
    const [updatedRoles] = await connection.execute(
      'SELECT ur.user_id, ur.role_id, r.name as role_name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = 2'
    );
    
    console.log('更新后的角色:', updatedRoles);
    
  } catch (error) {
    console.error('更新失败:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

fixUser2AdminRole();