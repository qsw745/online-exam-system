import { ConfigProvider, theme as antdTheme } from 'antd'
import React from 'react'
import { ThemeProvider, useTheme } from './hooks/useTheme'
import './styles/theme.css' // 你的全局 CSS 变量

function AntdThemeBridge({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme()
  const algorithm = theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm
  return <ConfigProvider theme={{ algorithm }}>{children}</ConfigProvider>
}

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AntdThemeBridge>{children}</AntdThemeBridge>
    </ThemeProvider>
  )
}
