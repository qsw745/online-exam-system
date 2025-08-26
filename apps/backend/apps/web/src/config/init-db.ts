import { createPool } from 'mysql2/promise';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initDatabase() {
  const pool = createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });

  try {
    // 创建数据库
    await pool.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'exam_system'};`);
    await pool.query(`USE ${process.env.DB_NAME || 'exam_system'};`);

    // 读取并执行 SQL 文件
    const sqlPath = path.join(__dirname, 'database.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await pool.query(sql);

    console.log('数据库初始化成功');

    // 创建演示账号
    const salt = await bcrypt.genSalt(10);
    
    const demoUsers = [
      { username: 'Admin Demo', email: 'admin@demo.com', password: 'demo123456', role: 'admin' },
      { username: 'Teacher Demo', email: 'teacher@demo.com', password: 'demo123456', role: 'teacher' },
      { username: 'Student Demo', email: 'student@demo.com', password: 'demo123456', role: 'student' }
    ];

    for (const user of demoUsers) {
      const hashedPassword = await bcrypt.hash(user.password, salt);
      await pool.query(
        'INSERT IGNORE INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
        [user.username, user.email, hashedPassword, user.role]
      );
    }

    console.log('演示账号创建成功');
  } catch (error) {
    console.error('数据库初始化失败:', error);
  } finally {
    await pool.end();
  }
}

initDatabase();