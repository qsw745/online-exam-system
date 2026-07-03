// apps/web/src/shared/utils/dayjs.ts
// 单点封装，解决 TS2306 与运行时兼容问题；所有代码都从这里引入 dayjs。
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import 'dayjs/locale/en'
import localeData from 'dayjs/plugin/localeData'
import relativeTime from 'dayjs/plugin/relativeTime'
import weekday from 'dayjs/plugin/weekday'
import weekOfYear from 'dayjs/plugin/weekOfYear'
import weekYear from 'dayjs/plugin/weekYear'
import customParseFormat from 'dayjs/plugin/customParseFormat'

dayjs.extend(localeData)
dayjs.extend(relativeTime)
dayjs.extend(weekday)
dayjs.extend(weekOfYear)
dayjs.extend(weekYear)
dayjs.extend(customParseFormat)

export function setDayjsLocaleForLanguage(language: string) {
  dayjs.locale(language === 'en-US' ? 'en' : 'zh-cn')
}

setDayjsLocaleForLanguage('zh-CN')

export default dayjs
