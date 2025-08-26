const mysql = require('mysql2/promise');
require('dotenv').config();

// 创建数据库连接
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

async function checkRoleData() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功');
    
    // 检查所有角色
    console.log('\n=== 所有角色 ===');
    const [roles] = await connection.execute('SELECT * FROM roles ORDER BY id');
    console.table(roles);
    
    // 检查角色ID为5的角色
    console.log('\n=== 角色ID为5的详情 ===');
    const [role5] = await connection.execute('SELECT * FROM roles WHERE id = 5');
    if (role5.length > 0) {
      console.table(role5);
    } else {
      console.log('角色ID为5不存在');
    }
    
    // 检查role_menus表中角色5的权限
    console.log('\n=== 角色5的菜单权限 ===');
    const [roleMenus] = await connection.execute('SELECT * FROM role_menus WHERE role_id = 5');
    if (roleMenus.length > 0) {
      console.table(roleMenus);
    } else {
      console.log('角色5没有分配任何菜单权限');
    }
    
    // 检查role_menus表的所有数据
    console.log('\n=== 所有角色菜单权限分配 ===');
    const [allRoleMenus] = await connection.execute(`
      SELECT rm.*, r.name as role_name, m.title as menu_title 
      FROM role_menus rm 
      LEFT JOIN roles r ON rm.role_id = r.id 
      LEFT JOIN menus m ON rm.menu_id = m.id 
      ORDER BY rm.role_id, rm.menu_id
    `);
    console.table(allRoleMenus);
    
  } catch (error) {
    console.error('检查数据失败:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

checkRoleData();