/* eslint-disable no-console */
import path from 'node:path'
import dotenv from 'dotenv'
import mysql from 'mysql2/promise'

dotenv.config({ path: path.join(__dirname, '../../.env') })

const { DB_HOST = '127.0.0.1', DB_PORT = '3306', DB_NAME = 'online_exam' } = process.env

async function main() {
  const candidates = [
    { user: 'root', password: process.env.ROOT_DB_PASSWORD || '' },
    { user: process.env.DB_USER || 'exam_user', password: process.env.DB_PASSWORD || 'exampwd' },
  ]
  let conn: mysql.Connection | null = null
  for (const c of candidates) {
    try {
      conn = await mysql.createConnection({
        host: DB_HOST,
        port: Number(DB_PORT),
        user: c.user,
        password: c.password,
        multipleStatements: true,
      })
      break
    } catch {}
  }
  if (!conn) {
    console.error('❌ 无法连接 MySQL，drop 失败')
    process.exit(1)
  }
  await conn.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\`;`)
  console.log(`🗑️ 已删除数据库：${DB_NAME}`)
  await conn.end()
}

main().catch(e => {
  console.error('❌ Drop 出错：', e)
  process.exit(1)
})
