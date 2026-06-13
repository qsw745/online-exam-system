import { DatePicker, Select } from 'antd'
import  dayjs from  '@/shared/utils/dayjs'
import React from 'react'
import type { DateRange } from '@/shared/hooks/useAnalytics'

const { RangePicker } = DatePicker
const { Option } = Select

type Props = {
  subjects: string[]
  selectedSubject: string
  onSubjectChange: (s: string) => void
  timeRange: DateRange
  onRangeChange: (r: DateRange) => void
}

export const AnalyticsFilters: React.FC<Props> = ({
  subjects,
  selectedSubject,
  onSubjectChange,
  timeRange,
  onRangeChange,
}) => {
  const handleRangeChange = (dates: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) onRangeChange([dates[0], dates[1]])
    else onRangeChange(null)
  }

  return (
    <div className="flex items-center space-x-4">
      <Select value={selectedSubject} onChange={onSubjectChange} style={{ width: 140 }}>
        <Option value="all">全部科目</Option>
        {subjects.map(s => (
          <Option key={s} value={s}>
            {s}
          </Option>
        ))}
      </Select>
      <RangePicker value={timeRange as any} onChange={handleRangeChange} format="YYYY-MM-DD" />
    </div>
  )
}
