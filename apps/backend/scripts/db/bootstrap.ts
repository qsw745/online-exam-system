/* eslint-disable no-console */
import path from 'node:path'
import fs from 'node:fs'
import dotenv from 'dotenv'
import mysql from 'mysql2/promise'

dotenv.config({ path: path.join(__dirname, '../../.env') })

const {
  DB_HOST = '127.0.0.1',
  DB_PORT = '3306',
  DB_NAME = 'online_exam',
  DB_USER = 'exam_user',
  DB_PASSWORD = 'exampwd',
} = process.env

// 若你用 root 账号跑迁移，可将 CREATE USER/GRANT 关掉；
// 我这里做了“按需创建”：仅当连接 root 成功且 DB_USER != 'root' 时尝试创建业务用户。
async function main() {
  // 1) 连接到“服务级”（不指定 database）
  const rootCandidates = [
    // 优先尝试 root（常见本机）
    { user: 'root', password: process.env.ROOT_DB_PASSWORD || '' },
    // 其次尝试 .env 里给的 DB_USER（如果本身就有权限也行）
    { user: DB_USER, password: DB_PASSWORD },
  ]

  let conn: mysql.Connection | null = null
  let chosen: { user: string; password: string } | null = null

  for (const c of rootCandidates) {
    try {
      conn = await mysql.createConnection({
        host: DB_HOST,
        port: Number(DB_PORT),
        user: c.user,
        password: c.password,
        // 不指定 database
        multipleStatements: true,
      })
      chosen = c
      break
    } catch {
      // try next
    }
  }

  if (!conn || !chosen) {
    console.error('❌ 无法连接 MySQL，请确认本机 MySQL 服务/账号密码是否正确（可尝试 brew services start mysql）')
    process.exit(1)
  }

  console.log(`✅ 已连接 MySQL（以 ${chosen.user}）`)

  // 2) 创建数据库（若不存在）
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`
     DEFAULT CHARACTER SET utf8mb4
     COLLATE utf8mb4_unicode_ci;`
  )
  console.log(`✅ 数据库准备就绪：${DB_NAME}`)

  // 3) 如用 root 连接，且目标用户不是 root，则确保业务用户存在并有权限
  if (chosen.user === 'root' && DB_USER !== 'root') {
    try {
      await conn.query(`CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY ?;`, [DB_PASSWORD])
      await conn.query(`CREATE USER IF NOT EXISTS '${DB_USER}'@'%'        IDENTIFIED BY ?;`, [DB_PASSWORD])
      await conn.query(`GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';`)
      await conn.query(`GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'%';`)
      await conn.query(`FLUSH PRIVILEGES;`)
      console.log(`✅ 业务用户/权限就绪：${DB_USER}`)
    } catch (e) {
      console.warn('⚠️ 创建业务用户失败（可能权限不足或已存在），将继续。', (e as Error).message)
    }
  }

  // 4) 额外：写一个“已初始化标记文件”，可选
  const mark = path.join(__dirname, '../../db/.bootstrap_ok')
  try {
    fs.writeFileSync(mark, new Date().toISOString(), 'utf8')
  } catch {}

  await conn.end()
  console.log('🎉 Bootstrap 完成')
}

main().catch(e => {
  console.error('❌ Bootstrap 出错：', e)
  process.exit(1)
})
