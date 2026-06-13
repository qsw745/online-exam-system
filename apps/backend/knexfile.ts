const path = require('node:path')
const fs = require('node:fs')
const dotenv = require('dotenv')

function loadEnvFile(filename, override = false) {
  const envPath = path.join(__dirname, filename)
  if (!fs.existsSync(envPath)) return
  dotenv.config({ path: envPath, override })
}

loadEnvFile('.env')
const nodeEnv = process.env.NODE_ENV || 'development'
loadEnvFile('.env.local', true)
loadEnvFile(`.env.${nodeEnv}.local`, true)

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
