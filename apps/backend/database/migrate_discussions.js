import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'exam_system',
  multipleStatements: true
};

async function migrateDiscussions() {
  let connection;
  
  try {
    // 连接数据库
    connection = await mysql.createConnection(dbConfig);
    console.log('已连接到 MySQL 数据库');
    
    // 读取 SQL 文件
    const sqlFile = path.join(__dirname, 'discussions.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    
    // 移除注释并按分号分割SQL语句
    const sqlStatements = sqlContent
      .split('\n')
      .filter(line => !line.trim().startsWith('--') && line.trim() !== '')
      .join('\n')
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0);
    
    console.log(`准备执行 ${sqlStatements.length} 条SQL语句`);
    
    // 执行每条SQL语句
    for (let i = 0; i < sqlStatements.length; i++) {
      const statement = sqlStatements[i];
      if (statement.trim()) {
        try {
          await connection.execute(statement);
          console.log(`✓ 执行第 ${i + 1} 条SQL语句成功`);
        } catch (error) {
          if (error.code === 'ER_TABLE_EXISTS_ERROR') {
            console.log(`⚠ 第 ${i + 1} 条SQL语句: 表已存在，跳过`);
          } else {
            console.error(`✗ 执行第 ${i + 1} 条SQL语句失败:`, error.message);
            throw error;
          }
        }
      }
    }
    
    console.log('\n🎉 讨论区模块数据库迁移完成！');
    
  } catch (error) {
    console.error('❌ 数据库迁移失败:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

// 执行迁移
migrateDiscussions();