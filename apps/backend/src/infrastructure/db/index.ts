/* eslint-disable @typescript-eslint/no-explicit-any */
// apps/backend/src/infrastructure/db/index.ts
// 目标：在“本机没加载到 @types/node”的情况下，仍能通过类型检查并正常运行。

import 'dotenv/config' // ✅ 副作用导入，避免 “dotenv 不是模块(2306)”
import { createPool, type Pool } from 'mysql2/promise'
import { enableSqlDebug } from '@/config/sql-debug'

// ✅ 本地 shim：即使 VSCode/TS 没读到 @types/node，也不会再报 “找不到名称 process (2591)”
declare const process: any

// 环境变量检查（此时 dotenv 已通过副作用完成 config）
if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
  console.error('[DB] 缺少必要的数据库配置：DB_HOST/DB_USER/DB_PASSWORD/DB_NAME')
  process.exit(1)
}

// 使用 mysql2/promise，得到 Promise Pool（带 query/execute）
export const pool: Pool = createPool({
  host: process.env.DB_HOST as string,
  user: process.env.DB_USER as string,
  password: process.env.DB_PASSWORD as string,
  database: process.env.DB_NAME as string,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONN_LIMIT ?? 10),
  queueLimit: 0,
  dateStrings: true,
  decimalNumbers: true,
  multipleStatements: false,
  namedPlaceholders: true,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  charset: 'utf8mb4',
  timezone: '+08:00',
})

// 测试数据库连接
pool
  .getConnection()
  .then(conn => {
    console.log('[DB] 数据库连接成功')
    conn.release()
  })
  .catch(err => {
    console.error('[DB] 数据库连接失败:', (err as Error).message)
    process.exit(1)
  })

// 连接级错误监听（部分声明不暴露 .on，这里用 any 防御以免类型报错）
;(pool as any).on?.('connection', (conn: any) => {
  conn.on?.('error', (err: any) => {
    console.error('[DB] MySQL connection error:', err)
    const code = err?.code as string | undefined
    if (code === 'PROTOCOL_CONNECTION_LOST') console.error('[DB] 数据库连接丢失')
    else if (code === 'ER_CON_COUNT_ERROR') console.error('[DB] 数据库连接过多')
    else if (code === 'ECONNREFUSED') console.error('[DB] 数据库连接被拒绝')
  })
})

// SQL 调试开关（你已有的工具函数）
enableSqlDebug(pool)
