import { DatePicker, Input, Button, Space } from 'antd'
import { Search } from 'lucide-react'
const { RangePicker } = DatePicker

export default function SystemLogsFilters({
  filters,
  onChange,
  onApply,
}: {
  filters: any
  onChange: (p: any) => void
  onApply: () => void
}) {
  return (
    <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
      <Input
        allowClear
        placeholder="所属模块"
        value={filters.module}
        onChange={e => onChange({ module: e.target.value })}
        prefix={<Search size={16} style={{ color: '#bfbfbf' }} />}
        style={{ width: 240 }}
      />
      <Input
        allowClear
        placeholder="请求接口"
        value={filters.action}
        onChange={e => onChange({ action: e.target.value })}
        prefix={<Search size={16} style={{ color: '#bfbfbf' }} />}
        style={{ width: 260 }}
      />
      <RangePicker value={filters.dateRange} onChange={v => onChange({ dateRange: v })} />
      <Button type="primary" icon={<Search size={16} />} onClick={onApply}>
        搜索
      </Button>
    </Space>
  )
}
