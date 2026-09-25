import assert from 'node:assert/strict'
import test from 'node:test'

import { buildDatabaseConnectionOptions } from './connection-options'

test('数据库连接配置使用显式 DB_PORT', () => {
  const options = buildDatabaseConnectionOptions({
    DB_HOST: '127.0.0.1',
    DB_PORT: '33306',
    DB_USER: 'root',
    DB_PASSWORD: 'secret',
    DB_NAME: 'exam_system',
  })

  assert.equal(options.port, 33306)
})

test('未配置 DB_PORT 时使用 MySQL 默认端口', () => {
  const options = buildDatabaseConnectionOptions({
    DB_HOST: '127.0.0.1',
    DB_USER: 'root',
    DB_PASSWORD: 'secret',
    DB_NAME: 'exam_system',
  })

  assert.equal(options.port, 3306)
})
