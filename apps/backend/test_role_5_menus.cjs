const mysql = require('mysql2/promise');
require('dotenv').config();

// 创建数据库连接
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

async function testRole5Menus() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功');
    
    // 查询角色ID为5的菜单权限
    const [roleMenus] = await connection.execute(
      'SELECT menu_id FROM role_menus WHERE role_id = ? ORDER BY menu_id',
      [5]
    );
    
    console.log(`角色ID为5的菜单权限数量: ${roleMenus.length}`);
    
    if (roleMenus.length > 0) {
      const menuIds = roleMenus.map(rm => rm.menu_id);
      console.log('菜单ID列表:', menuIds);
      
      // 获取菜单详细信息
      const [menuDetails] = await connection.execute(
        `SELECT id, name, title FROM menus WHERE id IN (${menuIds.map(() => '?').join(',')}) ORDER BY id`,
        menuIds
      );
      
      console.log('\n菜单详细信息:');
      menuDetails.forEach(menu => {
        console.log(`- ID: ${menu.id}, 名称: ${menu.name}, 标题: ${menu.title}`);
      });
    } else {
      console.log('角色ID为5没有分配任何菜单权限');
    }
    
  } catch (error) {
    console.error('查询失败:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

testRole5Menus();