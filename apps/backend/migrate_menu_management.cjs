const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// 读取SQL文件
const sqlFile = path.join(__dirname, 'src', 'database', 'menu_management.sql');
const sql = fs.readFileSync(sqlFile, 'utf8');

// 创建数据库连接
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: true
};

console.log('开始执行菜单管理模块数据库迁移...');

// MySQL可以直接使用原始SQL
const convertedSql = sql;

// 执行迁移
async function runMigration() {
  let connection;
  
  try {
    // 创建数据库连接
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功');
    
    // 直接执行整个SQL文件
    try {
      await connection.query(convertedSql);
      console.log('菜单管理模块SQL执行成功');
    } catch (err) {
      console.error('执行SQL时出错:', err.message);
      // 如果整体执行失败，尝试分段执行
      console.log('尝试分段执行SQL...');
      
      const statements = convertedSql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.trim()) {
          try {
            await connection.execute(statement);
            console.log(`第 ${i + 1} 条SQL语句执行成功: ${statement.substring(0, 50)}...`);
          } catch (err) {
            console.error(`执行第 ${i + 1} 条SQL语句时出错:`, err.message);
            console.error('完整SQL语句:', statement);
          }
        }
      }
    }
    
    console.log('菜单管理模块数据库迁移完成！');
    
  } catch (error) {
    console.error('数据库迁移失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭。');
    }
  }
}

// 运行迁移
runMigration();