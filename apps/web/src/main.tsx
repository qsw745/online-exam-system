import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '@ant-design/v5-patch-for-react-19'
import { ErrorBoundary } from '@/shared/components/ErrorBoundary'
import { formatDocumentTitle } from '@/shared/config/brand'
import { initializeAuthStorage } from '@/shared/api/core/storage'
import { resolveAppTarget } from '@/platform/appTarget'

import 'antd/dist/reset.css'
import './index.css'
import '@/shared/utils/dayjs'
import 'nprogress/nprogress.css'   // 先引入官方，确保基础结构
import '@/shared/styles/nprogress.css'    // 再引入你的覆盖样式（上面这份）
import '@/shared/styles/mobile-foundation.css'

document.title = formatDocumentTitle()
document.documentElement.dataset.appTarget = resolveAppTarget(import.meta.env.VITE_APP_TARGET)

const root = ReactDOM.createRoot(document.getElementById('root')!)

async function bootstrap() {
  try {
    await initializeAuthStorage()
    root.render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>,
    )
  } catch (error) {
    console.error(
      '[Wenheng bootstrap] secure session restore failed',
      error instanceof Error ? error.message : 'unknown error',
    )
    root.render(
      <main role="alert" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1>问衡暂时无法启动</h1>
          <p>安全会话恢复失败，请完全退出 App 后重新打开。</p>
        </div>
      </main>,
    )
  }
}

void bootstrap()
