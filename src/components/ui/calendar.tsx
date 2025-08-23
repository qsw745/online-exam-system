import * as React from "react"
import { Calendar as AntdCalendar } from "antd"
import type { CalendarProps as AntdCalendarProps } from "antd"
import { cn } from "../../lib/utils"
import dayjs, { Dayjs } from "dayjs"
import zhCN from 'antd/locale/zh_CN'

export interface CalendarProps extends Omit<AntdCalendarProps<Dayjs>, 'value' | 'onChange'> {
  className?: string
  value?: Date | Dayjs
  onChange?: (date: Date | Dayjs) => void
}

function Calendar({
  className,
  value,
  onChange,
  ...props
}: CalendarProps) {
  const handleChange = (date: Dayjs) => {
    if (onChange) {
      onChange(date)
    }
  }

  const calendarValue = value ? (dayjs.isDayjs(value) ? value : dayjs(value)) : undefined

  return (
    <div className={cn("w-full", className)}>
      <AntdCalendar
        value={calendarValue}
        onChange={handleChange}
        fullscreen={false}
        locale={zhCN}
        {...props}
      />
    </div>
  )
}
Calendar.displayName = "Calendar"

export { Calendar }