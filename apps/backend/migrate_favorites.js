import mysql from 'mysql2/promise';
import { promises as fs } from 'fs';
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

async function migrateFavorites() {
  let connection;
  
  try {
    console.log('开始收藏夹模块数据库迁移...');
    
    // 连接数据库
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功');
    
    // 读取SQL文件
    const sqlPath = path.join(__dirname, 'src', 'database', 'favorites.sql');
    const sqlContent = await fs.readFile(sqlPath, 'utf8');
    
    // 清理SQL内容，移除注释
    const cleanedSql = sqlContent
      .split('\n')
      .filter(line => !line.trim().startsWith('--') && line.trim().length > 0)
      .join('\n');
    
    // 分割SQL语句
    const statements = cleanedSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    console.log(`准备执行 ${statements.length} 条SQL语句`);
    
    // 执行SQL语句
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          await connection.execute(statement);
          console.log(`✓ 执行第 ${i + 1} 条SQL语句成功`);
        } catch (error) {
          console.error(`✗ 执行第 ${i + 1} 条SQL语句失败:`, error.message);
          console.error('SQL语句:', statement.substring(0, 100) + '...');
        }
      }
    }
    
    console.log('收藏夹模块数据库迁移完成！');
    
  } catch (error) {
    console.error('迁移过程中发生错误:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

// 运行迁移
migrateFavorites();