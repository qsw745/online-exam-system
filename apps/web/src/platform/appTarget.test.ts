import { describe, expect, it } from 'vitest'

import { resolveAppTarget } from './appTarget'

describe('resolveAppTarget', () => {
  it('显式 ios 构建返回 ios', () => {
    expect(resolveAppTarget('ios', false)).toBe('ios')
  })

  it('原生平台兜底返回 ios', () => {
    expect(resolveAppTarget(undefined, true)).toBe('ios')
  })

  it('普通浏览器保持 web', () => {
    expect(resolveAppTarget(undefined, false)).toBe('web')
  })

  it('未知值不得误进原生路由', () => {
    expect(resolveAppTarget('preview', false)).toBe('web')
  })
})
