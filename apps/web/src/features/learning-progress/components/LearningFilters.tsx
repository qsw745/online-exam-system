import type { LearningSubject } from '@/shared/api/endpoints/learningProgress'
import { DatePicker, Select } from 'antd'
import type { Dayjs } from 'dayjs'
import { translate } from '@/shared/utils/i18n'
import { useIsMobile } from '@/shared/hooks/useMobile'
import dayjs from '@/shared/utils/dayjs'
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
  subjects: LearningSubject[]
  timeRange: [Dayjs | null, Dayjs | null]
  onRangeChange: (v: [Dayjs | null, Dayjs | null]) => void
}) {
  const isMobile = useIsMobile()
  return (
    <div className="student-learning-filters">
      <Select aria-label="筛选科目" value={subject} onChange={onSubjectChange} style={{ width: 120 }}>
        <Option value="all">{translate('analytics.all_subjects')}</Option>
        {subjects.map(s => (
          <Option key={s.id} value={s.id}>
            {s.name}
          </Option>
        ))}
      </Select>
      {isMobile ? <div className="student-task-date-range">
        <label>开始日期<input type="date" value={timeRange[0]?.format('YYYY-MM-DD') || ''}
          max={timeRange[1]?.format('YYYY-MM-DD')} onChange={e => {
            const date = e.target.value ? dayjs(e.target.value) : null
            if (date && timeRange[1] && date.isAfter(timeRange[1], 'day')) return
            onRangeChange([date, timeRange[1]])
          }} /></label>
        <label>结束日期<input type="date" value={timeRange[1]?.format('YYYY-MM-DD') || ''}
          min={timeRange[0]?.format('YYYY-MM-DD')} onChange={e => {
            const date = e.target.value ? dayjs(e.target.value) : null
            if (date && timeRange[0] && date.isBefore(timeRange[0], 'day')) return
            onRangeChange([timeRange[0], date])
          }} /></label>
      </div> : <RangePicker value={timeRange} onChange={v => onRangeChange((v as any) ?? [null, null])} format="YYYY-MM-DD" />}
    </div>
  )
}
