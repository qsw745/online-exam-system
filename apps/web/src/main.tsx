import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '@ant-design/v5-patch-for-react-19'
import { ErrorBoundary } from '@/shared/components/ErrorBoundary'

import 'antd/dist/reset.css'
import './index.css'
import '@/shared/utils/dayjs'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
