import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test'

type StoredNativeSession = {
  accessToken: string
  mode: 'session' | 'local' | '7d'
  expiresAt: number | null
}

type DeletionCredential = { requestId: string; statusToken: string }

type MockKeychain = {
  session?: StoredNativeSession
  deletionStatus?: DeletionCredential
  calls: string[]
}

type DeletionMode = 'IMMEDIATE' | 'GRACE_PERIOD'

type DeletionStatus = {
  requestId: string
  mode: DeletionMode
  dataRegion: 'CN' | 'GLOBAL'
  status:
    | 'SCHEDULED'
    | 'COMPLETED_WITH_RESTRICTED_RETENTION'
    | 'CANCELLED'
  requestedAt: string
  scheduledFor: string
  startedAt: string | null
  cancelledAt: string | null
  completedAt: string | null
  restrictedRetentionUntil: string | null
  cancellable: boolean
  steps: Array<{
    stepCode: string
    category: string
    action: 'DELETE' | 'ANONYMIZE' | 'RESTRICTED_RETENTION'
    status: 'PENDING' | 'COMPLETED'
    plannedCount: number
    processedCount: number
    attemptCount: number
    lastErrorCode: string | null
  }>
}

type MockApiOptions = {
  failFirstDeletionRequest?: boolean
  onRequest?: (payload: Record<string, unknown>) => void
  requestStatus: (payload: Record<string, unknown>) => DeletionStatus
  lookupStatus: (payload: Record<string, unknown>) => DeletionStatus
  cancelStatus?: (payload: Record<string, unknown>) => DeletionStatus
}

const confirmationPhrase = '注销我的问衡账号'
const user = {
  id: 'e2e-student-1',
  email: 'student@example.com',
  role: 'student',
  nickname: '隐私测试考生',
  school: '问衡测试学校',
  class_name: '高三一班',
  data_region: 'CN',
}

const completedStatus = (credential: DeletionCredential, mode: DeletionMode = 'IMMEDIATE'): DeletionStatus => ({
  requestId: credential.requestId,
  mode,
  dataRegion: 'CN',
  status: 'COMPLETED_WITH_RESTRICTED_RETENTION',
  requestedAt: '2026-08-31T02:00:00.000Z',
  scheduledFor: '2026-08-31T02:00:00.000Z',
  startedAt: '2026-08-31T02:01:00.000Z',
  cancelledAt: null,
  completedAt: '2026-08-31T02:05:00.000Z',
  restrictedRetentionUntil: '2027-02-28T15:59:59.000Z',
  cancellable: false,
  steps: [
    {
      stepCode: 'profile',
      category: '账号资料',
      action: 'ANONYMIZE',
      status: 'COMPLETED',
      plannedCount: 1,
      processedCount: 1,
      attemptCount: 1,
      lastErrorCode: null,
    },
    {
      stepCode: 'exam-receipts',
      category: '考试合规回执',
      action: 'RESTRICTED_RETENTION',
      status: 'COMPLETED',
      plannedCount: 2,
      processedCount: 2,
      attemptCount: 1,
      lastErrorCode: null,
    },
  ],
})

const scheduledStatus = (credential: DeletionCredential): DeletionStatus => ({
  requestId: credential.requestId,
  mode: 'GRACE_PERIOD',
  dataRegion: 'GLOBAL',
  status: 'SCHEDULED',
  requestedAt: '2026-08-31T02:00:00.000Z',
  scheduledFor: '2026-09-30T02:00:00.000Z',
  startedAt: null,
  cancelledAt: null,
  completedAt: null,
  restrictedRetentionUntil: null,
  cancellable: true,
  steps: [
    {
      stepCode: 'profile',
      category: '账号资料',
      action: 'DELETE',
      status: 'PENDING',
      plannedCount: 1,
      processedCount: 0,
      attemptCount: 0,
      lastErrorCode: null,
    },
  ],
})

const cancelledStatus = (credential: DeletionCredential): DeletionStatus => ({
  ...scheduledStatus(credential),
  status: 'CANCELLED',
  cancelledAt: '2026-08-31T02:10:00.000Z',
  cancellable: false,
})

async function installMockKeychain(context: BrowserContext, state: MockKeychain) {
  await context.exposeFunction(
    '__wenhengSecureSessionInvoke',
    async ({ pluginName, method, options }: { pluginName: string; method: string; options?: unknown }) => {
      if (pluginName !== 'WenhengSecureSession') throw new Error(`unexpected plugin: ${pluginName}`)
      state.calls.push(method)
      switch (method) {
        case 'read':
          return state.session ? { session: state.session } : {}
        case 'write':
          state.session = options as StoredNativeSession
          return undefined
        case 'clear':
          delete state.session
          return undefined
        case 'readDeletionStatus':
          return state.deletionStatus ? { credential: state.deletionStatus } : {}
        case 'writeDeletionStatus':
          state.deletionStatus = options as DeletionCredential
          return undefined
        case 'clearDeletionStatus':
          delete state.deletionStatus
          return undefined
        default:
          throw new Error(`unexpected secure-session method: ${method}`)
      }
    },
  )

  await context.addInitScript(() => {
    const root = globalThis as typeof globalThis & {
      Capacitor?: Record<string, unknown>
      __wenhengSecureSessionInvoke: (input: {
        pluginName: string
        method: string
        options?: unknown
      }) => Promise<unknown>
    }
    root.Capacitor = {
      PluginHeaders: [
        {
          name: 'WenhengSecureSession',
          methods: [
            'read',
            'write',
            'clear',
            'readDeletionStatus',
            'writeDeletionStatus',
            'clearDeletionStatus',
          ].map(name => ({ name, rtype: 'promise' })),
        },
      ],
      nativePromise(pluginName: string, method: string, options?: unknown) {
        return root.__wenhengSecureSessionInvoke({ pluginName, method, options })
      },
    }
    localStorage.setItem('language', 'zh-CN')
  })
}

function attachConsoleGuard(page: Page, errors: string[]) {
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))
}

async function fulfill(route: Route, data: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(status >= 400
      ? { success: false, message: String(data), status }
      : { success: true, data }),
  })
}

async function installMockApi(context: BrowserContext, options: MockApiOptions) {
  let deletionRequestCount = 0
  await context.route('**/api/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (!url.pathname.startsWith('/api/')) return route.continue()
    const path = url.pathname.replace(/^\/api/, '')
    const method = request.method()
    const payload = request.postDataJSON?.() as Record<string, unknown> | null

    if (method === 'GET' && path === '/users/me') return fulfill(route, user)
    if (method === 'GET' && path === '/profile') return fulfill(route, user)
    if (method === 'GET' && path === '/public/settings') return fulfill(route, {})
    if (method === 'GET' && path === '/account/deletion/preview') {
      return fulfill(route, {
        status: 'NOT_REQUESTED',
        confirmationPhrase,
        graceDays: 30,
        scheduledFor: '2026-09-30T02:00:00.000Z',
        deleteOrAnonymize: ['登录凭据', '个人资料', '人脸凭据'],
        conditionalRetention: ['考试合规回执仅按法定期限隔离保留'],
        disclaimer: '本页为本地端到端测试夹具，不会删除真实数据。',
      })
    }
    if (method === 'POST' && path === '/account/deletion/request') {
      deletionRequestCount += 1
      options.onRequest?.(payload ?? {})
      if (options.failFirstDeletionRequest && deletionRequestCount === 1) {
        return route.abort('failed')
      }
      return fulfill(route, options.requestStatus(payload ?? {}))
    }
    if (method === 'POST' && path === '/account/deletion/status') {
      return fulfill(route, options.lookupStatus(payload ?? {}))
    }
    if (method === 'POST' && path === '/account/deletion/cancel' && options.cancelStatus) {
      return fulfill(route, options.cancelStatus(payload ?? {}))
    }
    if (method === 'POST' && path === '/auth/logout') return fulfill(route, { ok: true })

    return fulfill(route, `未声明的本地模拟接口：${method} ${path}`, 501)
  })
}

async function assertNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }))).toMatchObject({
    viewport: page.viewportSize()!.width,
    document: page.viewportSize()!.width,
    body: page.viewportSize()!.width,
  })
}

async function openProfile(page: Page) {
  await page.goto('/profile')
  await expect(page.getByRole('heading', { name: '注销问衡账号' })).toBeVisible()
  await expect(page.getByText('本页为本地端到端测试夹具，不会删除真实数据。')).toBeVisible()
}

async function fillDeletionForm(page: Page, mode: DeletionMode) {
  await page.getByRole('radio', { name: mode === 'IMMEDIATE' ? '立即删除' : '30 天后删除' }).check()
  await page.getByLabel('当前密码').fill('E2e-password-1')
  await page.getByLabel('确认词').fill(confirmationPhrase)
}

const phoneViewports = [
  { name: 'iPhone-SE-375x667', viewport: { width: 375, height: 667 }, deviceScaleFactor: 2 },
  { name: 'iPhone-15-393x852', viewport: { width: 393, height: 852 }, deviceScaleFactor: 3 },
] as const

for (const phone of phoneViewports) {
  test.describe(`本地模拟 API + 模拟 Keychain 桥接：${phone.name}`, () => {
    test.use({ viewport: phone.viewport, deviceScaleFactor: phone.deviceScaleFactor })

  test('网络中断复用同一立即注销请求，并在杀页面后恢复受限保留状态', async ({ context, page }) => {
    const keychain: MockKeychain = {
      session: { accessToken: 'e2e.invalid.jwt', mode: 'session', expiresAt: null },
      calls: [],
    }
    const requestPayloads: Array<Record<string, unknown>> = []
    const consoleErrors: string[] = []

    await installMockKeychain(context, keychain)
    await installMockApi(context, {
      failFirstDeletionRequest: true,
      onRequest: payload => requestPayloads.push(payload),
      requestStatus: payload => completedStatus({
        requestId: String(payload.requestId),
        statusToken: String(payload.statusToken),
      }),
      lookupStatus: payload => completedStatus({
        requestId: String(payload.requestId ?? keychain.deletionStatus?.requestId),
        statusToken: String(payload.statusToken ?? keychain.deletionStatus?.statusToken),
      }),
    })
    attachConsoleGuard(page, consoleErrors)

    await openProfile(page)
    await assertNoHorizontalOverflow(page)
    await fillDeletionForm(page, 'IMMEDIATE')
    await page.getByRole('button', { name: '确认并冻结账号' }).click()

    await expect(page.getByText('请求结果尚未确认，凭证已安全保留。请恢复网络后使用同一请求重试。')).toBeVisible()
    expect(keychain.deletionStatus).toBeTruthy()
    await page.getByRole('button', { name: '使用同一请求重试' }).click()

    await expect(page).toHaveURL(/\/account-deletion$/)
    await expect(page.getByText('注销已完成，存在依法限期保留数据')).toBeVisible()
    await expect(page.getByText('依法必须保留的最小范围数据已经隔离，仅用于法定义务与争议处理，不再用于登录、推荐、营销或产品分析。')).toBeVisible()
    expect(requestPayloads).toHaveLength(2)
    expect(requestPayloads[1]).toMatchObject({
      requestId: requestPayloads[0].requestId,
      statusToken: requestPayloads[0].statusToken,
      mode: 'IMMEDIATE',
    })
    expect(keychain.session).toBeUndefined()
    expect(keychain.deletionStatus).toEqual({
      requestId: requestPayloads[0].requestId,
      statusToken: requestPayloads[0].statusToken,
    })
    await assertNoHorizontalOverflow(page)

    await page.close()
    const reopenedPage = await context.newPage()
    attachConsoleGuard(reopenedPage, consoleErrors)
    await reopenedPage.goto('/account-deletion')
    await expect(reopenedPage.getByText('注销已完成，存在依法限期保留数据')).toBeVisible()
    await expect(reopenedPage.getByText('考试合规回执')).toBeVisible()
    await assertNoHorizontalOverflow(reopenedPage)
    expect(keychain.calls.filter(call => call === 'readDeletionStatus').length).toBeGreaterThanOrEqual(2)
    expect(consoleErrors.filter(error => !error.includes('net::ERR_FAILED'))).toEqual([])
    expect(consoleErrors.filter(error => error.includes('net::ERR_FAILED'))).toHaveLength(1)
  })

  test('提交 30 天宽限注销、取消，并用账号凭据恢复已完成状态', async ({ context, page }) => {
    const keychain: MockKeychain = {
      session: { accessToken: 'e2e.invalid.jwt', mode: 'session', expiresAt: null },
      calls: [],
    }
    const requestPayloads: Array<Record<string, unknown>> = []
    const consoleErrors: string[] = []

    await installMockKeychain(context, keychain)
    await installMockApi(context, {
      onRequest: payload => requestPayloads.push(payload),
      requestStatus: payload => scheduledStatus({
        requestId: String(payload.requestId),
        statusToken: String(payload.statusToken),
      }),
      lookupStatus: payload => {
        if ('email' in payload) {
          return completedStatus({
            requestId: '7a699dc7-27dc-48c5-9afd-0132dd389914',
            statusToken: 'a'.repeat(43),
          }, 'GRACE_PERIOD')
        }
        return scheduledStatus({
          requestId: String(payload.requestId),
          statusToken: String(payload.statusToken),
        })
      },
      cancelStatus: () => cancelledStatus(keychain.deletionStatus!),
    })
    attachConsoleGuard(page, consoleErrors)

    await openProfile(page)
    await fillDeletionForm(page, 'GRACE_PERIOD')
    await expect(page.getByText('提交后有 30 天宽限期，执行开始前可以取消。')).toBeVisible()
    await page.getByRole('button', { name: '确认并冻结账号' }).click()

    await expect(page).toHaveURL(/\/account-deletion$/)
    await expect(page.getByText('已安排，等待宽限期结束')).toBeVisible()
    await expect(page.getByRole('button', { name: '取消注销申请' })).toBeVisible()
    expect(requestPayloads).toHaveLength(1)
    expect(requestPayloads[0]).toMatchObject({ mode: 'GRACE_PERIOD' })
    await assertNoHorizontalOverflow(page)

    await page.getByRole('button', { name: '取消注销申请' }).click()
    const dialog = page.getByRole('dialog', { name: '验证身份并取消注销' })
    await dialog.getByLabel('账号邮箱').fill(user.email)
    await dialog.getByLabel('账号密码').fill('E2e-password-1')
    await dialog.getByRole('button', { name: '验证并取消申请' }).click()

    await expect(page).toHaveURL(/\/login$/)
    expect(keychain.deletionStatus).toBeUndefined()
    await assertNoHorizontalOverflow(page)

    await page.goto('/account-deletion')
    await expect(page.getByRole('heading', { name: '恢复注销进度' })).toBeVisible()
    await page.getByLabel('账号邮箱').fill(user.email)
    await page.getByLabel('账号密码').fill('E2e-password-1')
    await page.getByRole('button', { name: '查询最新状态' }).click()
    await expect(page.getByText('注销已完成，存在依法限期保留数据')).toBeVisible()
    await expect(page.getByText('最长保留至')).toBeVisible()
    await assertNoHorizontalOverflow(page)
    expect(consoleErrors).toEqual([])
  })
  })
}
