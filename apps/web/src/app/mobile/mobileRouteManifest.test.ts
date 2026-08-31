import { describe, expect, it } from 'vitest'

import { mobileRouteManifest } from './mobileRouteManifest'

describe('mobileRouteManifest', () => {
  it('仅开放已确认的考生端入口', () => {
    expect(mobileRouteManifest.map((route) => route.path)).toEqual([
      '/login',
      '/register',
      '/forgot-password',
      '/reset-password',
      '/verify-email',
      '/oauth/callback',
      '/legal/terms',
      '/legal/privacy',
      '/account-deletion',
      '/dashboard',
      '/tasks/my',
      '/tasks/detail/:id',
      '/student/learning',
      '/questions/:id/practice',
      '/wrong-questions',
      '/favorites',
      '/profile',
      '/settings',
      '/exam/:id',
      '/exam/task/:taskId',
      '/results',
      '/results/:id',
      '/proctoring/reviews/:caseId',
    ])
  })

  it.each(['/admin', '/m/face-auth', '/qr', '/papers', '/users'])(
    '不允许后台或人脸登录前缀 %s 进入 iOS 路由',
    (blockedPrefix) => {
      expect(
        mobileRouteManifest.some((route) => route.path.startsWith(blockedPrefix)),
      ).toBe(false)
    },
  )

  it('考试路由必须使用沉浸模式', () => {
    const examRoutes = mobileRouteManifest.filter((route) => route.path.startsWith('/exam/'))

    expect(examRoutes).toHaveLength(2)
    expect(examRoutes.every((route) => 'immersive' in route && route.immersive === true)).toBe(true)
  })
})
