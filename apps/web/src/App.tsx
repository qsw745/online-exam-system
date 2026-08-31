// apps/web/src/App.tsx
import React, { Suspense } from 'react'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AuthProvider } from '@/shared/contexts/AuthContext'
import { LanguageProvider } from '@/shared/contexts/LanguageContext'
import { MenuPermissionProvider } from '@/shared/contexts/MenuPermissionContext'
import { webRouter } from '@/app/routes'
import { mobileRouter } from '@/app/mobile/MobileAppRouter'
import { resolveAppTarget } from '@/platform/appTarget'
import { RuntimeProvider, useRuntime } from '@/platform/runtime/RuntimeProvider'
import BackgroundPrivacyCover from '@/platform/privacy/BackgroundPrivacyCover'
import AppProviders from '@/AppProviders'

const appTarget = resolveAppTarget(import.meta.env.VITE_APP_TARGET)
const appRouter = appTarget === 'ios' ? mobileRouter : webRouter

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // v5: 不能在 defaultOptions 放 suspense
      // suspense: true,
      // v5: useErrorBoundary 已删除，改用 throwOnError
      throwOnError: true,
      retry: 2,
      retryDelay: 1000,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      networkMode: 'offlineFirst' as const,
    },
    mutations: {
      // 可选：保持和 v4 相似的错误边界行为
      throwOnError: true,
      retry: 1,
      networkMode: 'offlineFirst' as const,
    },
  },
})

function ApplicationContent() {
  const { snapshot } = useRuntime()

  return (
    <>
      <AuthProvider>
        <LanguageProvider>
          <AppProviders>
            {appTarget === 'ios' ? (
              <Suspense fallback={null}>
                <RouterProvider router={appRouter} />
              </Suspense>
            ) : (
              <MenuPermissionProvider>
                {/* v5 全局 Suspense：用 React 的 <Suspense> 包裹路由 */}
                <Suspense fallback={null}>
                  <RouterProvider router={appRouter} />
                </Suspense>
              </MenuPermissionProvider>
            )}
          </AppProviders>
        </LanguageProvider>
      </AuthProvider>
      {appTarget === 'ios' && <BackgroundPrivacyCover lifecycle={snapshot.lifecycle} />}
    </>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RuntimeProvider>
        <ApplicationContent />
      </RuntimeProvider>
    </QueryClientProvider>
  )
}
