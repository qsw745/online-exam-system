const mysql = require('mysql2/promise');
require('dotenv').config();

// 创建数据库连接
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

async function checkUser2Roles() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功');
    
    // 查询用户ID为2的角色关联
    const [userRoles] = await connection.execute(
      'SELECT ur.user_id, ur.role_id, r.name as role_name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = 2'
    );
    
    console.log('用户ID为2的角色关联:', userRoles);
    
    if (userRoles.length === 0) {
      console.log('用户ID为2没有分配任何角色，需要分配管理员角色');
      
      // 为用户ID为2分配管理员角色（角色ID为2）
      await connection.execute(
        'INSERT INTO user_roles (user_id, role_id) VALUES (2, 2) ON DUPLICATE KEY UPDATE role_id = role_id'
      );
      
      console.log('已为用户ID为2分配管理员角色(ID:2)');
      
      // 再次查询验证
      const [updatedUserRoles] = await connection.execute(
        'SELECT ur.user_id, ur.role_id, r.name as role_name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = 2'
      );
      
      console.log('更新后的角色关联:', updatedUserRoles);
    }
    
  } catch (error) {
    console.error('查询失败:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

checkUser2Roles();