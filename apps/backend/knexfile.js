// apps/backend/knexfile.js
require('dotenv/config')

/**
 * 用 MySQL2 作为驱动；开发/生产用同一套配置（按需拆分）
 * 需要的环境变量：
 *   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 *   可选：DB_SSL=true/false
 */
const common = {
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'online_exam',
    // 如果云数据库需要 SSL，可打开：
    // ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  },
  pool: { min: 0, max: 10 },
  migrations: {
    tableName: 'knex_migrations',
    directory: './db/migrations',
    extension: 'js',
  },
  seeds: {
    directory: './db/seeds',
    extension: 'js',
  },
}

module.exports = {
  development: common,
  production: common,
}
