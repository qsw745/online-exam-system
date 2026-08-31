import { describe, expect, it } from 'vitest'

import { resolveAuthCapabilities } from './mobileAuthCapabilities'

describe('resolveAuthCapabilities', () => {
  it('iOS 第一阶段只开放邮箱密码登录', () => {
    expect(resolveAuthCapabilities('ios')).toEqual({
      oauth: false,
      faceLogin: false,
      qrLogin: false,
    })
  })

  it('Web 保持现有登录能力', () => {
    expect(resolveAuthCapabilities('web')).toEqual({
      oauth: true,
      faceLogin: true,
      qrLogin: true,
    })
  })
})
