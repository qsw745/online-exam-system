import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// 全局 Provider
import { AuthProvider } from '@/shared/contexts/AuthContext'
import { LanguageProvider } from '@/shared/contexts/LanguageContext'
import { MenuPermissionProvider } from '@/shared/contexts/MenuPermissionContext'
import { AppProviders } from './AppProviders'

// 路由树（Data Router）—— ✅ 修正导入路径
import { router } from '@/app/routes'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      suspense: true, // ✅ 关键
      useErrorBoundary: true, // 建议配合错误边界
      retry: 2,
      retryDelay: 1000,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: 1,
      networkMode: 'offlineFirst',
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MenuPermissionProvider>
          <LanguageProvider>
            <AppProviders>
              <RouterProvider router={router} />
            </AppProviders>
          </LanguageProvider>
        </MenuPermissionProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
