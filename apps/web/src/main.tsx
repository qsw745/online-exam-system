// main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ConfigProvider } from 'antd';
import { DatePicker, Space } from 'antd';
import zhCN from 'antd/locale/zh_CN';

// 导入 Ant Design 样式
import 'antd/dist/reset.css';
// 导入自定义样式
import './index.css';

import updateLocale from 'dayjs/plugin/updateLocale';
import weekday from 'dayjs/plugin/weekday';
import localeData from 'dayjs/plugin/localeData';
import locale from 'antd/locale/zh_CN';
import dayjs from 'dayjs';

import 'dayjs/locale/zh-cn';

dayjs.locale('zh-cn');
import 'dayjs/locale/zh-cn';
const { RangePicker } = DatePicker;

// 扩展 dayjs，添加必要的插件
dayjs.extend(updateLocale);
dayjs.extend(weekday);
dayjs.extend(localeData);

// 设置中文环境
dayjs.locale('zh-cn');

// 自定义星期名称
dayjs.updateLocale('zh-cn', {
  weekdays: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
  weekdaysShort: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
  weekdaysMin: ['日', '一', '二', '三', '四', '五', '六']
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
 
       <ConfigProvider locale={zhCN}>

     <App />
</ConfigProvider>
  </ErrorBoundary>

)
