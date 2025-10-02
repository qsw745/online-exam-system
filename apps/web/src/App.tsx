import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AuthProvider } from '@/shared/contexts/AuthContext'
import { LanguageProvider } from '@/shared/contexts/LanguageContext'
import { MenuPermissionProvider } from '@/shared/contexts/MenuPermissionContext'

import { router } from '@/app/routes'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      suspense: true,
      useErrorBoundary: true,
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
            <RouterProvider router={router} />
          </LanguageProvider>
        </MenuPermissionProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
