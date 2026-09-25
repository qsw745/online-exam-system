import assert from 'node:assert/strict'
import test from 'node:test'

import { buildDemoUserSeedRows } from './demo-user-seed'

test('演示用户种子为移动账号约束提供稳定公开标识和大陆区域', () => {
  const rows = buildDemoUserSeedRows('NOW', true)

  assert.deepEqual(
    rows.map(row => ({
      email: row.email,
      publicId: row.public_id,
      dataRegion: row.data_region,
      role: row.role,
    })),
    [
      {
        email: 'admin@demo.com',
        publicId: '00000000-0000-4000-8000-000000000001',
        dataRegion: 'CN',
        role: 'admin',
      },
      {
        email: 'teacher@demo.com',
        publicId: '00000000-0000-4000-8000-000000000002',
        dataRegion: 'CN',
        role: 'teacher',
      },
      {
        email: 'student@demo.com',
        publicId: '00000000-0000-4000-8000-000000000003',
        dataRegion: 'CN',
        role: 'student',
      },
    ],
  )
})

test('旧表没有 role 列时演示用户种子不写 role', () => {
  const rows = buildDemoUserSeedRows('NOW', false)

  assert.equal(rows.every(row => !('role' in row)), true)
})
