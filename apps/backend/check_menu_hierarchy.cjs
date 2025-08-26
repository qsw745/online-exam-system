const mysql = require('mysql2/promise');

async function checkMenuHierarchy() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'exam_system'
  });
  
  const [rows] = await conn.execute('SELECT id, name, title, parent_id FROM menus ORDER BY parent_id, sort_order');
  
  console.log('菜单层级结构:');
  
  const roots = rows.filter(m => m.parent_id === null);
  const children = rows.filter(m => m.parent_id !== null);
  
  console.log(`\n根菜单 (parent_id = null): ${roots.length}个`);
  roots.forEach(r => {
    console.log(`  - ID: ${r.id}, Name: ${r.name}, Title: ${r.title}`);
  });
  
  console.log(`\n子菜单 (parent_id != null): ${children.length}个`);
  children.forEach(c => {
    console.log(`  - ID: ${c.id}, Name: ${c.name}, Title: ${c.title}, Parent: ${c.parent_id}`);
  });
  
  // 检查每个根菜单的子菜单
  console.log('\n详细层级结构:');
  roots.forEach(root => {
    console.log(`\n${root.title} (ID: ${root.id})`);
    const rootChildren = children.filter(c => c.parent_id === root.id);
    if (rootChildren.length > 0) {
      rootChildren.forEach(child => {
        console.log(`  └─ ${child.title} (ID: ${child.id})`);
      });
    } else {
      console.log(`  └─ (无子菜单)`);
    }
  });
  
  await conn.end();
}

checkMenuHierarchy().catch(console.error);