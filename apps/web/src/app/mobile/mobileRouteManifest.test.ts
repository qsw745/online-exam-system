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
      '/learning/practice',
      '/learning/practice/:id',
      '/practice/:id',
      '/learning/wrong-questions',
      '/learning/favorites',
      '/learning/progress',
      '/questions/:id/practice',
      '/questions/:id',
      '/wrong-questions',
      '/favorites',
      '/profile',
      '/settings',
      '/exam/:id',
      '/exam/task/:taskId',
      '/exam/results',
      '/results',
      '/results/:id',
      '/proctoring/reviews/:caseId',
      '/shared/favorites/:code',
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
    const examRoutes = mobileRouteManifest.filter(
      (route) => 'immersive' in route && route.immersive === true,
    )

    expect(examRoutes).toHaveLength(2)
    expect(examRoutes.every((route) => 'immersive' in route && route.immersive === true)).toBe(true)
  })

  it('登记学生端页面使用的兼容路径，避免旧入口落到 404', () => {
    const registeredPaths = new Set(mobileRouteManifest.map((route) => route.path))

    expect([...registeredPaths]).toEqual(
      expect.arrayContaining([
        '/learning/practice',
        '/learning/practice/:id',
        '/practice/:id',
        '/learning/wrong-questions',
        '/learning/favorites',
        '/learning/progress',
        '/questions/:id',
        '/exam/results',
        '/shared/favorites/:code',
      ]),
    )
  })
})
