// src/AppProviders.tsx
import type { PropsWithChildren } from 'react'
import { AntdThemeProvider } from '@app/providers/AntdThemeProvider'

// 全局样式：统一从 shared 引入
import '@shared/styles/theme.css'
import '@shared/styles/antd-override.css'

export function AppProviders({ children }: PropsWithChildren) {
  // 以后还要加别的 Provider（SWR/Sentry/MSW 等），也放到这里包裹
  return <AntdThemeProvider>{children}</AntdThemeProvider>
}

// 同时提供默认导出，避免其它地方误用默认导入时报错
export default AppProviders
