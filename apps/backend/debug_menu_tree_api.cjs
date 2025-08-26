const mysql = require('mysql2/promise');
require('dotenv').config();

// 创建数据库连接池
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 模拟MenuService的getUserMenuPermissions方法
async function getUserMenuPermissions(userId) {
  const [rows] = await pool.execute(
    `SELECT DISTINCT 
       m.id as menu_id,
       m.name as menu_name,
       m.title as menu_title,
       m.path,
       m.component,
       m.icon,
       m.parent_id,
       m.sort_order,
       m.level,
       m.menu_type,
       m.permission_code,
       m.redirect,
       m.meta,
       CASE 
         WHEN um.permission_type = 'deny' THEN FALSE
         WHEN um.permission_type = 'grant' THEN TRUE
         WHEN rm.menu_id IS NOT NULL THEN TRUE
         ELSE FALSE
       END as has_permission
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
  
  return rows.map(row => ({
    ...row,
    meta: row.meta ? (typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta) : null,
    has_permission: Boolean(row.has_permission)
  }));
}

// 模拟buildMenuTree方法
function buildMenuTree(menus, parentId = null) {
  const tree = [];
  
  for (const menu of menus) {
    if (menu.parent_id === parentId) {
      const node = {
        ...menu,
        children: buildMenuTree(menus, menu.id)
      };
      tree.push(node);
    }
  }
  
  return tree.sort((a, b) => a.sort_order - b.sort_order);
}

// 模拟getUserMenuTree方法
async function getUserMenuTree(userId) {
  console.log(`\n=== 调试用户ID ${userId} 的菜单树构建 ===`);
  
  const permissions = await getUserMenuPermissions(userId);
  console.log(`\n1. 获取到 ${permissions.length} 个菜单权限`);
  
  const accessibleMenus = permissions
    .filter(p => p.has_permission)
    .map(p => ({
      id: p.menu_id,
      name: p.menu_name,
      title: p.menu_title,
      path: p.path,
      component: p.component,
      icon: p.icon,
      parent_id: p.parent_id,
      sort_order: p.sort_order,
      level: p.level,
      is_hidden: false,
      is_disabled: false,
      is_system: false,
      menu_type: p.menu_type,
      permission_code: p.permission_code,
      redirect: p.redirect,
      meta: p.meta,
      created_at: '',
      updated_at: ''
    }));
  
  console.log(`\n2. 过滤后有权限的菜单数量: ${accessibleMenus.length}`);
  console.log('有权限的菜单ID:', accessibleMenus.map(m => m.id));
  
  // 查找菜单ID为3和61
  const menu3 = accessibleMenus.find(m => m.id === 3);
  const menu61 = accessibleMenus.find(m => m.id === 61);
  
  console.log(`\n3. 菜单ID为3: ${menu3 ? '存在' : '不存在'}`);
  console.log(`   菜单ID为61: ${menu61 ? '存在' : '不存在'}`);
  
  if (menu3) {
    console.log('   菜单3详情:', {
      id: menu3.id,
      title: menu3.title,
      parent_id: menu3.parent_id,
      sort_order: menu3.sort_order
    });
  }
  
  if (menu61) {
    console.log('   菜单61详情:', {
      id: menu61.id,
      title: menu61.title,
      parent_id: menu61.parent_id,
      sort_order: menu61.sort_order
    });
  }
  
  console.log('\n4. 开始构建菜单树...');
  const tree = buildMenuTree(accessibleMenus);
  
  console.log(`\n5. 构建完成，顶级菜单数量: ${tree.length}`);
  
  // 查找菜单ID为3的节点
  const menu3Node = tree.find(node => node.id === 3);
  if (menu3Node) {
    console.log(`\n6. 菜单ID为3的节点:`);
    console.log(`   标题: ${menu3Node.title}`);
    console.log(`   子菜单数量: ${menu3Node.children.length}`);
    if (menu3Node.children.length > 0) {
      console.log('   子菜单列表:');
      menu3Node.children.forEach(child => {
        console.log(`     - ID: ${child.id}, 标题: ${child.title}`);
      });
    }
  } else {
    console.log('\n6. 未找到菜单ID为3的节点');
  }
  
  return tree;
}

async function debugMenuTreeAPI() {
  try {
    await getUserMenuTree(2);
  } catch (error) {
    console.error('调试失败:', error.message);
  } finally {
    await pool.end();
  }
}

debugMenuTreeAPI();