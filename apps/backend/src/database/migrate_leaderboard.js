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

async function migrateLeaderboard() {
  let connection;
  
  try {
    console.log('连接到 MySQL 数据库...');
    connection = await mysql.createConnection(dbConfig);
    
    console.log('读取排行榜模块 SQL 文件...');
    const sqlFile = path.join(__dirname, 'leaderboard.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    console.log('执行排行榜模块数据库迁移...');
    
    // 分割 SQL 语句并逐个执行
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement) {
        console.log(`执行第 ${i + 1} 条 SQL 语句...`);
        await connection.execute(statement);
      }
    }
    
    console.log('排行榜模块数据库迁移完成！');
    console.log('已创建以下表：');
    console.log('- leaderboards (排行榜配置表)');
    console.log('- leaderboard_records (排行榜记录表)');
    console.log('- competitions (竞赛表)');
    console.log('- competition_participants (竞赛参与记录表)');
    console.log('- leaderboard_achievements (排行榜成就表)');
    console.log('已插入默认排行榜配置数据');
    
  } catch (error) {
    console.error('排行榜模块数据库迁移失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

// 执行迁移
migrateLeaderboard();