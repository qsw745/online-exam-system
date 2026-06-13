import { DatePicker, Select } from 'antd'
import type { Dayjs } from 'dayjs'
const { RangePicker } = DatePicker
const { Option } = Select

export default function LearningFilters({
  subject,
  onSubjectChange,
  subjects,
  timeRange,
  onRangeChange,
}: {
  subject: string
  onSubjectChange: (v: string) => void
  subjects: string[]
  timeRange: [Dayjs | null, Dayjs | null]
  onRangeChange: (v: [Dayjs | null, Dayjs | null]) => void
}) {
  return (
    <div className="flex items-center space-x-3">
      <Select value={subject} onChange={onSubjectChange} style={{ width: 120 }}>
        <Option value="all">全部科目</Option>
        {subjects.map(s => (
          <Option key={s} value={s}>
            {s}
          </Option>
        ))}
      </Select>
      <RangePicker value={timeRange} onChange={v => onRangeChange((v as any) ?? [null, null])} format="YYYY-MM-DD" />
    </div>
  )
}
