const path = require('node:path')
require('dotenv').config({ path: path.join(__dirname, '.env') })

const common = {
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'online_exam',
  },
  pool: { min: 0, max: 10 },
  migrations: {
    tableName: 'knex_migrations',
    directory: path.join(__dirname, 'db/migrations'), // ← 改这里
    extension: 'ts',
    loadExtensions: ['.ts'],
  },
  seeds: {
    directory: path.join(__dirname, 'db/seeds'), // ← 以及这里（若有）
    extension: 'ts',
    loadExtensions: ['.ts'],
  },
}

module.exports = { development: common, production: common }
