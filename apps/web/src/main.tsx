// src/main.tsx
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AntdThemeProvider } from './providers/AntdThemeProvider'

import 'antd/dist/reset.css'
import './index.css'
import './styles/theme.css'

import dayjs from 'dayjs'
import localeData from 'dayjs/plugin/localeData'
import updateLocale from 'dayjs/plugin/updateLocale'
import weekday from 'dayjs/plugin/weekday'
import 'dayjs/locale/zh-cn'

dayjs.locale('zh-cn')
dayjs.extend(updateLocale)
dayjs.extend(weekday)
dayjs.extend(localeData)
dayjs.updateLocale('zh-cn', {
  weekdays: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
  weekdaysShort: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
  weekdaysMin: ['日', '一', '二', '三', '四', '五', '六'],
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <AntdThemeProvider>
      <App />
    </AntdThemeProvider>
  </ErrorBoundary>
)
