import { describe, expect, it } from 'vitest'
import { getLoginReturnPath } from './loginReturnPath'

describe('登录后恢复站内位置', () => {
  it('保留路由守卫中的路径、查询和锚点', () => {
    expect(getLoginReturnPath({ from: { pathname: '/tasks/detail/42', search: '?view=detail', hash: '#intro' } }))
      .toBe('/tasks/detail/42?view=detail#intro')
  })
  it('支持会话过期后的整页跳转参数', () => {
    expect(getLoginReturnPath(null, '?returnTo=%2Fresults%2F700%3Ftab%3Dquestions')).toBe('/results/700?tab=questions')
  })
  it.each(['https://outside.test', '//outside.test', '/\\outside.test', '/%2foutside.test', '/%5coutside.test', '/%0aevil', '/login?returnTo=/profile', '/foo/../login', '/reset-password?token=x', '/oauth/callback', '/%'])('忽略不安全地址或认证循环 %s', path => {
    expect(getLoginReturnPath({ from: path })).toBeNull()
  })
})
