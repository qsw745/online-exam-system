// apps/backend/src/config/init-db.ts
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 用 127.0.0.1 避免某些环境下 localhost 的命名管道差异
const DB_HOST = process.env.DB_HOST || '127.0.0.1'
const DB_PORT = Number(process.env.DB_PORT || 3306)
const DB_USER = process.env.DB_USER || 'root'
const DB_PASSWORD = process.env.DB_PASSWORD || ''
const DB_NAME = process.env.DB_NAME || 'exam_system'

async function initDatabase() {
  // 先连“服务器级”创建数据库
  const serverPool = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: 5,
    multipleStatements: true,
  })

  try {
    console.log(`[init-db] connect ${DB_HOST}:${DB_PORT}`)
    await serverPool.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`
       DEFAULT CHARACTER SET utf8mb4
       COLLATE utf8mb4_unicode_ci;`
    )
    console.log(`[init-db] database ready: ${DB_NAME}`)

    // 再连到指定数据库，执行迁移
    const pool = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 5,
      multipleStatements: true,
    })

    // 1) 先兼容：如果仍然提供了 database.sql，就先执行它（可选）
    // const dbSqlPath = path.resolve(__dirname, 'database.sql')
    // if (fs.existsSync(dbSqlPath)) {
    //   console.log('[init-db] run database.sql')
    //   const sql = fs.readFileSync(dbSqlPath, 'utf8')
    //   if (sql.trim()) await pool.query(sql)
    // }

    // 2) 正式迁移：执行 migrations 目录的所有 .sql
    const migrationsDir = path.resolve(__dirname, './migrations')
    if (!fs.existsSync(migrationsDir)) {
      console.warn(`[init-db] migrations dir not found: ${migrationsDir}（可忽略）`)
    } else {
      const files = fs
        .readdirSync(migrationsDir)
        .filter(f => f.toLowerCase().endsWith('.sql'))
        .sort()

      if (files.length === 0) {
        console.warn(`[init-db] no .sql files in ${migrationsDir}`)
      } else {
        console.log(`[init-db] applying ${files.length} migrations:\n  - ${files.join('\n  - ')}`)
        for (const file of files) {
          const full = path.join(migrationsDir, file)
          const sql = fs.readFileSync(full, 'utf8')
          if (!sql.trim()) {
            console.log(`[init-db] skip empty: ${file}`)
            continue
          }
          console.log(`[init-db] execute: ${file}`)
          await pool.query(sql)
        }
      }
    }

    // 3) 种演示账号（幂等）
    const salt = await bcrypt.genSalt(10)
    const demoUsers = [
      { username: 'Admin Demo', email: 'admin@demo.com', password: 'demo123456', role: 'admin' },
      { username: 'Teacher Demo', email: 'teacher@demo.com', password: 'demo123456', role: 'teacher' },
      { username: 'Student Demo', email: 'student@demo.com', password: 'demo123456', role: 'student' },
    ]
    for (const u of demoUsers) {
      const hashed = await bcrypt.hash(u.password, salt)
      await pool.query(
        `INSERT INTO users (username,email,password,role,status,created_at,updated_at)
         VALUES (?,?,?,?, 'active', NOW(), NOW())
         ON DUPLICATE KEY UPDATE username=VALUES(username), role=VALUES(role)`,
        [u.username, u.email, hashed, u.role]
      )
    }
    console.log('[init-db] demo users ready')

    await pool.end()
    console.log('[init-db] ✅ done')
  } catch (err) {
    console.error('数据库初始化失败:', err)
    process.exit(1)
  } finally {
    await serverPool.end()
  }
}

initDatabase()
