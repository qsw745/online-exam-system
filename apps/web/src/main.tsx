import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// 新路径（shared 通用组件）
import { ErrorBoundary } from '@shared/components/ErrorBoundary'

// 全局样式（Ant Design 重置 + 你的 index.css）
import 'antd/dist/reset.css'
import './index.css'

// dayjs 统一在 shared/utils/dayjs 内完成本地化与插件挂载
import '@shared/utils/dayjs'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
