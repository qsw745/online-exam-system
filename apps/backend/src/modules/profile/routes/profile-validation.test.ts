import assert from 'node:assert/strict'
import test from 'node:test'
import { validationResult } from 'express-validator'
import { updateProfileValidation } from './profile-validation.js'
const validate = async (body: object) => {
  const req = { body }
  await Promise.all(updateProfileValidation.map(rule => rule.run(req)))
  return validationResult(req)
}
test('个人资料允许清空可选电话、学校、班级和简介', async () => {
  assert.equal((await validate({ phone: '', school: '', class_name: '', bio: '' })).isEmpty(), true)
})
test('清空可选字段不放宽昵称、邮箱和非空电话校验', async () => {
  for (const body of [{ nickname: '' }, { nickname: '长'.repeat(51) }, { email: '' }, { phone: '12' }, { phone: '1'.repeat(31) }]) {
    assert.equal((await validate(body)).isEmpty(), false)
  }
  assert.equal((await validate({ nickname: '学生', email: 'student@example.com', phone: '123456' })).isEmpty(), true)
})
