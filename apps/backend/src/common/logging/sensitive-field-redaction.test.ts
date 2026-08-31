import assert from 'node:assert/strict'
import test from 'node:test'

import { buildHttpLogContext, coarsenIpForLogging } from '../middleware/http-logger'
import {
  redactSensitiveFields,
  redactSensitiveText,
  sanitizeSqlErrorMetadata,
} from './sensitive-field-redaction'

test('递归日志脱敏覆盖嵌套对象和数组且不修改原对象', () => {
  const original = {
    email: 'user@example.com',
    profile: {
      phone: '13800138000',
      values: [{ statusToken: 'secret-token' }, { Password: 'password-value' }],
    },
    safe: 'request-123',
  }
  const snapshot = structuredClone(original)

  assert.deepEqual(redactSensitiveFields(original), {
    email: '[REDACTED]',
    profile: {
      phone: '[REDACTED]',
      values: [{ statusToken: '[REDACTED]' }, { Password: '[REDACTED]' }],
    },
    safe: 'request-123',
  })
  assert.deepEqual(original, snapshot)
})

test('自由文本移除邮箱、手机号和四十三字符状态令牌', () => {
  const token = Buffer.alloc(32, 7).toString('base64url')
  const result = redactSensitiveText(`email=user@example.com phone=13800138000 token=${token}`)
  assert.equal(result.includes('user@example.com'), false)
  assert.equal(result.includes('13800138000'), false)
  assert.equal(result.includes(token), false)
  assert.match(result, /\[REDACTED_EMAIL\].*\[REDACTED_PHONE\].*\[REDACTED_TOKEN\]/)
})

test('SQL 错误元信息不保留 SQL 原文和参数', () => {
  const metadata = sanitizeSqlErrorMetadata({
    code: 'ER_DUP_ENTRY',
    errno: 1062,
    sqlState: '23000',
    sqlMessage: "Duplicate entry 'user@example.com'",
    sql: 'INSERT INTO users(email, password) VALUES (?, ?)',
    parameters: ['user@example.com', 'secret-password'],
  })

  assert.deepEqual(metadata, {
    code: 'ER_DUP_ENTRY',
    errno: 1062,
    sqlState: '23000',
    sqlMessage: "Duplicate entry '[REDACTED_EMAIL]'",
  })
})

test('HTTP 日志只使用无查询串路径和粗粒度 IP', () => {
  const context = buildHttpLogContext({
    requestId: 'request-123',
    method: 'POST',
    path: '/api/account/deletion/status',
    clientIp: '203.0.113.57',
    now: new Date('2026-08-31T08:00:00.000Z'),
  })
  const serialized = JSON.stringify(context)

  assert.equal(context.url, '/api/account/deletion/status')
  assert.equal(context.ip, '203.0.113.0/24')
  assert.equal(serialized.includes('statusToken='), false)
  assert.equal(serialized.includes('203.0.113.57'), false)
  assert.equal(coarsenIpForLogging('2001:db8:1234:5678::1'), '2001:db8:1234::/48')
})
