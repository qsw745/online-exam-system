const mysql = require('mysql2/promise');
const axios = require('axios');

// 数据库配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'exam_system'
};

async function testMenuComparison() {
  let connection;
  
  try {
    // 1. 直接查询数据库
    console.log('=== 1. 直接查询数据库 ===');
    connection = await mysql.createConnection(dbConfig);
    const [dbRows] = await connection.execute('SELECT * FROM menus ORDER BY sort_order ASC, id ASC');
    console.log(`数据库中的菜单数量: ${dbRows.length}`);
    console.log('数据库菜单列表:');
    dbRows.forEach(menu => {
      console.log(`  - ID: ${menu.id}, Name: ${menu.name}, Title: ${menu.title}`);
    });
    
    // 2. 测试后端API
    console.log('\n=== 2. 测试后端API ===');
    try {
      const apiResponse = await axios.get('http://localhost:3000/api/menu/menus');
      console.log(`API返回状态: ${apiResponse.status}`);
      console.log(`API返回成功标志: ${apiResponse.data.success}`);
      console.log(`API返回菜单数量: ${apiResponse.data.data ? apiResponse.data.data.length : 0}`);
      
      if (apiResponse.data.data) {
        console.log('API返回菜单列表:');
        apiResponse.data.data.forEach(menu => {
          console.log(`  - ID: ${menu.id}, Name: ${menu.name}, Title: ${menu.title}`);
        });
      }
      
      // 3. 比较数据
      console.log('\n=== 3. 数据比较 ===');
      if (dbRows.length === apiResponse.data.data.length) {
        console.log('✓ 数据库和API返回的菜单数量一致');
      } else {
        console.log(`✗ 数据库菜单数量(${dbRows.length}) 与 API返回数量(${apiResponse.data.data.length}) 不一致`);
      }
      
      // 检查每个菜单项
      const dbMenuIds = dbRows.map(m => m.id).sort();
      const apiMenuIds = apiResponse.data.data.map(m => m.id).sort();
      
      console.log('数据库菜单ID:', dbMenuIds);
      console.log('API返回菜单ID:', apiMenuIds);
      
      const missingInApi = dbMenuIds.filter(id => !apiMenuIds.includes(id));
      const extraInApi = apiMenuIds.filter(id => !dbMenuIds.includes(id));
      
      if (missingInApi.length > 0) {
        console.log('API中缺失的菜单ID:', missingInApi);
      }
      if (extraInApi.length > 0) {
        console.log('API中多出的菜单ID:', extraInApi);
      }
      
    } catch (apiError) {
      console.error('API调用失败:', apiError.message);
    }
    
  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testMenuComparison();