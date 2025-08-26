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

async function testUserPermissions() {
  // 初始化fetch
  await initFetch();
  
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功');
    
    // 1. 获取不同角色的用户
    console.log('\n=== 1. 获取不同角色的用户 ===');
    const [users] = await connection.execute(
      'SELECT id, username, email, role FROM users ORDER BY role, id LIMIT 10'
    );
    
    console.log('用户列表:');
    users.forEach(user => {
      console.log(`  [${user.id}] ${user.username} (${user.email}) - 角色: ${user.role}`);
    });
    
    // 2. 测试不同用户的菜单权限
    console.log('\n=== 2. 测试不同用户的菜单权限 ===');
    
    for (const user of users.slice(0, 5)) { // 只测试前5个用户
      console.log(`\n--- 测试用户: ${user.username} (ID: ${user.id}, 角色: ${user.role}) ---`);
      
      try {
        // 测试API调用
        const response = await fetch(`http://localhost:3000/api/menu/users/${user.id}/permissions`);
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.success) {
            const hasPermissionCount = data.data.filter(p => p.has_permission).length;
            const totalMenus = data.data.length;
            
            console.log(`  总菜单数: ${totalMenus}`);
            console.log(`  有权限的菜单数: ${hasPermissionCount}`);
            
            // 统计权限来源
            const permissionSources = {};
            data.data.filter(p => p.has_permission).forEach(menu => {
              const source = menu.permission_source;
              permissionSources[source] = (permissionSources[source] || 0) + 1;
            });
            
            console.log('  权限来源统计:', permissionSources);
            
            // 如果不是admin但有很多权限，显示详细信息
            if (user.role !== 'admin' && hasPermissionCount > 10) {
              console.log('  ⚠️  非admin用户但有大量权限，前10个有权限的菜单:');
              data.data.filter(p => p.has_permission).slice(0, 10).forEach(menu => {
                console.log(`    [${menu.menu_id}] ${menu.menu_title || menu.menu_name} - ${menu.permission_source}`);
              });
            }
            
            // 如果是admin，验证是否所有菜单都有权限
            if (user.role === 'admin') {
              const allHavePermission = data.data.every(p => p.has_permission);
              console.log(`  所有菜单都有权限: ${allHavePermission}`);
            }
          } else {
            console.log(`  API返回错误: ${data.message}`);
          }
        } else {
          console.log(`  API请求失败: ${response.status} ${response.statusText}`);
        }
      } catch (apiError) {
        console.log(`  API调用异常: ${apiError.message}`);
      }
    }
    
    // 3. 检查用户角色分配情况
    console.log('\n=== 3. 检查用户角色分配情况 ===');
    
    const [userRoles] = await connection.execute(
      `SELECT 
         u.id as user_id,
         u.username,
         u.role as user_role,
         r.id as role_id,
         r.name as role_name,
         r.code as role_code
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       WHERE u.id IN (${users.map(u => u.id).join(',')})
       ORDER BY u.id, r.id`
    );
    
    console.log('用户角色分配:');
    const userRoleMap = {};
    userRoles.forEach(ur => {
      if (!userRoleMap[ur.user_id]) {
        userRoleMap[ur.user_id] = {
          username: ur.username,
          user_role: ur.user_role,
          assigned_roles: []
        };
      }
      if (ur.role_id) {
        userRoleMap[ur.user_id].assigned_roles.push({
          id: ur.role_id,
          name: ur.role_name,
          code: ur.role_code
        });
      }
    });
    
    Object.entries(userRoleMap).forEach(([userId, info]) => {
      console.log(`  [${userId}] ${info.username} (用户角色: ${info.user_role})`);
      if (info.assigned_roles.length > 0) {
        info.assigned_roles.forEach(role => {
          console.log(`    - 分配角色: [${role.id}] ${role.name} (${role.code})`);
        });
      } else {
        console.log(`    - 无分配角色`);
      }
    });
    
    // 4. 检查角色菜单权限
    console.log('\n=== 4. 检查角色菜单权限 ===');
    
    const [roleMenus] = await connection.execute(
      `SELECT 
         r.id as role_id,
         r.name as role_name,
         r.code as role_code,
         COUNT(rm.menu_id) as menu_count
       FROM roles r
       LEFT JOIN role_menus rm ON r.id = rm.role_id
       WHERE r.is_disabled = FALSE
       GROUP BY r.id, r.name, r.code
       ORDER BY r.id`
    );
    
    console.log('角色菜单权限统计:');
    roleMenus.forEach(role => {
      console.log(`  [${role.role_id}] ${role.role_name} (${role.role_code}) - ${role.menu_count} 个菜单权限`);
    });
    
  } catch (error) {
    console.error('测试失败:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

testUserPermissions();