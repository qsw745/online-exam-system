import type { PropsWithChildren } from 'react'
import { AntdThemeProvider } from '@/app/providers/AntdThemeProvider'
import { LayoutProvider } from '@/shared/contexts/LayoutContext'

import '@/shared/styles/theme.css'
import '@/shared/styles/antd-override.css'

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <LayoutProvider>
      <AntdThemeProvider>{children}</AntdThemeProvider>
    </LayoutProvider>
  )
}

export default AppProviders
