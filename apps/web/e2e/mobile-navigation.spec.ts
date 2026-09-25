import { expect, test } from '@playwright/test'

// 只隔离 API 和系统 Keychain；路由、页面、CSS 与滚动行为均使用真实实现。
test.beforeEach(async ({ context }) => {
  await context.exposeFunction('__navigationTestKeychain', async (method: string) => {
    if (method === 'read') return { session: { accessToken: 'navigation-test-session', mode: 'session', expiresAt: null } }
    return {}
  })
  await context.addInitScript(() => {
    const root = globalThis as any
    root.Capacitor = {
      PluginHeaders: [{
        name: 'WenhengSecureSession',
        methods: ['read', 'write', 'clear', 'readDeletionStatus', 'writeDeletionStatus', 'clearDeletionStatus']
          .map(name => ({ name, rtype: 'promise' })),
      }],
      nativePromise(_plugin: string, method: string) { return root.__navigationTestKeychain(method) },
    }
    localStorage.setItem('language', 'zh-CN')
  })
  await context.route('**/api/**', async route => {
    const pathname = new URL(route.request().url()).pathname
    if (!pathname.startsWith('/api/')) return route.continue()
    const path = pathname.replace(/^\/api/, '')
    const user = { id: 'navigation-student', email: 'navigation@example.com', nickname: '导航测试考生', role: 'student', data_region: 'CN' }
    const fixtures: Record<string, unknown> = {
      '/users/me': user,
      '/profile': user,
      '/public/settings': {},
      '/questions/practice-stats': { totalPractice: 0, correctRate: 0, masteredQuestions: 0 },
      '/account/deletion/preview': {
        status: 'NOT_REQUESTED', confirmationPhrase: '注销我的问衡账号', graceDays: 30,
        deleteOrAnonymize: ['登录凭据', '个人资料'], conditionalRetention: ['依法保留考试合规记录'],
        disclaimer: '仅用于导航测试，不提交账号操作。',
      },
    }
    if (!(path in fixtures)) throw new Error(`未声明的测试请求：${path}`)
    await route.fulfill({ json: { success: true, data: fixtures[path] } })
  })
})

for (const viewport of [{ width: 393, height: 852 }, { width: 375, height: 567 }]) {
  test(`从个人页底部切换标签后回到新页面顶部 ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('/profile')
    const nav = page.getByRole('navigation', { name: '考生主导航' })

    // 覆盖首次懒加载与后续缓存命中两种切换。
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await page.getByRole('button', { name: '退出登录', exact: true }).scrollIntoViewIfNeeded()
      await expect(page.getByRole('heading', { name: '我的', exact: true })).not.toBeInViewport()
      await nav.getByRole('link', { name: '学习', exact: true }).click()
      await expect(page).toHaveURL(/\/student\/learning$/)
      await expect(page.getByRole('heading', { name: '学习', exact: true })).toBeInViewport({ ratio: 1 })
      await expect(page.getByRole('link', { name: '题目练习', exact: true })).toBeInViewport({ ratio: 1 })
      await expect(nav.getByRole('link', { name: '学习', exact: true })).toHaveAttribute('aria-current', 'page')
      await nav.getByRole('link', { name: '我的', exact: true }).click()
      await expect(page.getByRole('heading', { name: '我的', exact: true })).toBeInViewport({ ratio: 1 })
    }
    expect(errors).toEqual([])
  })

  test(`原生页面滚动与路由恢复使用同一个文档容器 ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/profile')
    await page.getByRole('button', { name: '退出登录', exact: true }).scrollIntoViewIfNeeded()
    // 路由的 ScrollRestoration 使用 window.scrollY，不能另有 body 滚动容器。
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100)
    await expect.poll(() => page.evaluate(() => document.body.scrollTop)).toBe(0)
    await page.getByRole('navigation').getByRole('link', { name: '学习', exact: true }).click()
    await expect(page.getByRole('heading', { name: '学习', exact: true })).toBeInViewport({ ratio: 1 })
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  })
}
