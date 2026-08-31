import { describe, expect, it } from 'vitest'

import { decodeOfflineAccessClaims } from './offlineAccessClaims'

function token(payload: Record<string, unknown>) {
  const encode = (value: unknown) => btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
  return `${encode({ alg: 'none' })}.${encode(payload)}.`
}

describe('离线安全会话声明', () => {
  it('从尚未过期的访问令牌恢复考试所需最小用户身份', () => {
    expect(
      decodeOfflineAccessClaims(
        token({
          id: 7,
          email: 'student@example.com',
          type: 'access',
          exp: 2_000_000_000,
          roles: [{ id: 3, code: 'student' }],
          public_id: 'c867d51a-b98d-4abe-bbb7-2601a4b924be',
          data_region: 'CN',
        }),
        1_900_000_000_000,
      ),
    ).toEqual({
      id: '7',
      email: 'student@example.com',
      role: 'student',
      public_id: 'c867d51a-b98d-4abe-bbb7-2601a4b924be',
      data_region: 'CN',
    })
  })

  it('拒绝过期、刷新类型或缺少角色的令牌', () => {
    expect(decodeOfflineAccessClaims(token({ id: 7, type: 'access', exp: 1 }), 2_000)).toBeNull()
    expect(decodeOfflineAccessClaims(token({ id: 7, type: 'refresh', exp: 2_000_000_000 }), 1)).toBeNull()
    expect(decodeOfflineAccessClaims(token({ id: 7, type: 'access', exp: 2_000_000_000 }), 1)).toBeNull()
  })
})
