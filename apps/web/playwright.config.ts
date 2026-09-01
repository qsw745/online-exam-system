import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const outputRoot = fileURLToPath(new URL('../../output/playwright/', import.meta.url))

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  outputDir: `${outputRoot}test-results`,
  reporter: [
    ['line'],
    ['html', { outputFolder: `${outputRoot}report`, open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4176',
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 375, height: 667 },
        deviceScaleFactor: 2,
        hasTouch: true,
        isMobile: true,
      },
    },
  ],
  webServer: {
    command: 'pnpm run dev:ios:e2e',
    url: 'http://127.0.0.1:4176',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
