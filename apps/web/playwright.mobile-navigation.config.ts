import { defineConfig } from '@playwright/test'
import base from './playwright.config'

export default defineConfig({
  ...base,
  testMatch: 'mobile-navigation.spec.ts',
  projects: ['chromium', 'webkit'].map(browserName => ({
    name: browserName,
    use: { browserName: browserName as 'chromium' | 'webkit', isMobile: true, hasTouch: true },
  })),
})
