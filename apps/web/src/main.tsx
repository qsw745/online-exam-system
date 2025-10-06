import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '@ant-design/v5-patch-for-react-19'
import { ErrorBoundary } from '@/shared/components/ErrorBoundary'

import 'antd/dist/reset.css'
import './index.css'
import '@/shared/utils/dayjs'
import 'nprogress/nprogress.css'   // 先引入官方，确保基础结构
import '@/shared/styles/nprogress.css'    // 再引入你的覆盖样式（上面这份）

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
