import { DatePicker, Select } from 'antd'
import type { Dayjs } from 'dayjs'
import { translate } from '@/shared/utils/i18n'
const { RangePicker } = DatePicker
const { Option } = Select

type Board = { id: number; name: string }

type Props = {
  boards: Board[]
  boardId: number | null
  onBoardChange: (id: number) => void

  subjects: string[]
  subject: string
  onSubjectChange: (v: string) => void

  timeRange: [Dayjs | null, Dayjs | null]
  onRangeChange: (v: [Dayjs | null, Dayjs | null]) => void
}

export default function LeaderboardFilters({
  boards,
  boardId,
  onBoardChange,
  subjects,
  subject,
  onSubjectChange,
  timeRange,
  onRangeChange,
}: Props) {
  return (
    <div className="flex items-center space-x-4">
      <Select value={boardId ?? undefined} onChange={onBoardChange} style={{ width: 200 }} placeholder={translate('auto.68ffcaadbd')}>
        {boards.map(b => (
          <Option key={b.id} value={b.id}>
            {b.name ?? `榜单 #${b.id}`}
          </Option>
        ))}
      </Select>

      <Select value={subject} onChange={onSubjectChange} style={{ width: 140 }}>
        <Option value="all">{translate('analytics.all_subjects')}</Option>
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
