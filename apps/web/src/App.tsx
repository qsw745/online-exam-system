// apps/web/src/App.tsx
import React, { Suspense } from 'react'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AuthProvider } from '@/shared/contexts/AuthContext'
import { LanguageProvider } from '@/shared/contexts/LanguageContext'
import { MenuPermissionProvider } from '@/shared/contexts/MenuPermissionContext'
import { router } from '@/app/routes'

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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MenuPermissionProvider>
          <LanguageProvider>
            {/* v5 全局 Suspense：用 React 的 <Suspense> 包裹路由 */}
            <Suspense fallback={null}>
              <RouterProvider router={router} />
            </Suspense>
          </LanguageProvider>
        </MenuPermissionProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
