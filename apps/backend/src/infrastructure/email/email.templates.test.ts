import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPasswordResetEmail, buildVerificationEmail } from './email.templates.js'

test('verification email uses Wenheng brand and keeps verification URL', () => {
  const email = buildVerificationEmail({ username: '小衡', verifyUrl: 'https://example.test/verify?token=abc' })
  assert.equal(email.subject, '邮箱验证 - 问衡')
  assert.match(email.html, /感谢注册问衡/)
  assert.match(email.html, /https:\/\/example\.test\/verify\?token=abc/)
  assert.doesNotMatch(email.text, /在线考试系统/)
})

test('password reset email uses Wenheng brand and keeps reset URL', () => {
  const email = buildPasswordResetEmail({ username: '小衡', resetUrl: 'https://example.test/reset?token=xyz' })
  assert.equal(email.subject, '密码重置请求 - 问衡')
  assert.match(email.text, /https:\/\/example\.test\/reset\?token=xyz/)
  assert.doesNotMatch(email.html, /在线考试系统/)
})
