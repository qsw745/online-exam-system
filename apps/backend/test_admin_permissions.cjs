const mysql = require('mysql2/promise');
require('dotenv').config();

// 动态导入fetch
let fetch;

async function initFetch() {
  const fetchModule = await import('node-fetch');
  fetch = fetchModule.default;
}

// 创建数据库连接
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

async function testAdminPermissions() {
  // 初始化fetch
  await initFetch();
  
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功');
    
    // 1. 检查admin用户信息
    console.log('\n=== 1. 检查admin用户信息 ===');
    const [adminUsers] = await connection.execute(
      'SELECT id, username, email, role FROM users WHERE role = "admin"'
    );
    
    console.log('Admin用户列表:', adminUsers);
    
    if (adminUsers.length === 0) {
      console.log('没有找到admin用户');
      return;
    }
    
    const adminUserId = adminUsers[0].id;
    console.log(`使用admin用户ID: ${adminUserId}`);
    
    // 2. 直接调用数据库查询测试权限逻辑
    console.log('\n=== 2. 直接数据库查询测试 ===');
    
    // 检查用户角色
    const [userInfo] = await connection.execute(
      'SELECT role FROM users WHERE id = ?',
      [adminUserId]
    );
    
    const isAdmin = userInfo.length > 0 && userInfo[0].role === 'admin';
    console.log(`用户是否为admin: ${isAdmin}`);
    
    if (isAdmin) {
      // 获取所有菜单（admin应该看到所有菜单）
      const [allMenus] = await connection.execute(
        `SELECT DISTINCT 
           m.id as menu_id,
           m.name as menu_name,
           m.title as menu_title,
           m.path,
           m.parent_id,
           m.sort_order,
           m.level,
           TRUE as has_permission,
           'admin' as permission_source
         FROM menus m
         WHERE m.is_disabled = FALSE
         ORDER BY m.sort_order ASC, m.id ASC`
      );
      
      console.log(`Admin用户应该看到的菜单数量: ${allMenus.length}`);
      console.log('前10个菜单:');
      allMenus.slice(0, 10).forEach(menu => {
        console.log(`  [${menu.menu_id}] ${menu.menu_title || menu.menu_name} - ${menu.path || 'no-path'}`);
      });
    }
    
    // 3. 测试API调用
    console.log('\n=== 3. 测试API调用 ===');
    
    try {
      // 测试获取用户菜单权限API
      const response = await fetch(`http://localhost:3000/api/menu/users/${adminUserId}/permissions`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success) {
          console.log(`API返回菜单权限数量: ${data.data.length}`);
          
          const hasPermissionCount = data.data.filter(p => p.has_permission).length;
          console.log(`有权限的菜单数量: ${hasPermissionCount}`);
          
          // 检查权限来源
          const adminPermissions = data.data.filter(p => p.permission_source === 'admin');
          console.log(`admin权限来源的菜单数量: ${adminPermissions.length}`);
          
          console.log('\n前10个有权限的菜单:');
          data.data.filter(p => p.has_permission).slice(0, 10).forEach(menu => {
            console.log(`  [${menu.menu_id}] ${menu.menu_title || menu.menu_name} - ${menu.permission_source}`);
          });
          
          // 检查是否所有菜单都有权限
          const allHavePermission = data.data.every(p => p.has_permission);
          console.log(`\n所有菜单都有权限: ${allHavePermission}`);
          
          if (!allHavePermission) {
            console.log('\n没有权限的菜单:');
            data.data.filter(p => !p.has_permission).forEach(menu => {
              console.log(`  [${menu.menu_id}] ${menu.menu_title || menu.menu_name}`);
            });
          }
        } else {
          console.log('API返回错误:', data.message);
        }
      } else {
        console.log('API请求失败:', response.status, response.statusText);
      }
    } catch (apiError) {
      console.log('API调用异常:', apiError.message);
    }
    
    // 4. 测试菜单树API
    console.log('\n=== 4. 测试菜单树API ===');
    
    try {
      const treeResponse = await fetch(`http://localhost:3000/api/menu/users/${adminUserId}/menus`);
      
      if (treeResponse.ok) {
        const treeData = await treeResponse.json();
        
        if (treeData.success) {
          console.log(`菜单树根节点数量: ${treeData.data.length}`);
          
          function countMenuNodes(menus) {
            let count = 0;
            menus.forEach(menu => {
              count++;
              if (menu.children && menu.children.length > 0) {
                count += countMenuNodes(menu.children);
              }
            });
            return count;
          }
          
          const totalNodes = countMenuNodes(treeData.data);
          console.log(`菜单树总节点数量: ${totalNodes}`);
          
          console.log('\n菜单树结构:');
          function printMenuTree(menus, level = 0) {
            menus.forEach(menu => {
              const indent = '  '.repeat(level);
              console.log(`${indent}[${menu.id}] ${menu.title}`);
              if (menu.children && menu.children.length > 0) {
                printMenuTree(menu.children, level + 1);
              }
            });
          }
          
          printMenuTree(treeData.data);
        } else {
          console.log('菜单树API返回错误:', treeData.message);
        }
      } else {
        console.log('菜单树API请求失败:', treeResponse.status, treeResponse.statusText);
      }
    } catch (treeError) {
      console.log('菜单树API调用异常:', treeError.message);
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

testAdminPermissions();