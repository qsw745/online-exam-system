import { DatePicker, Input, Select, Button, Space } from 'antd'
import { Search } from 'lucide-react'
const { RangePicker } = DatePicker

export default function OperationLogsFilters({
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
        placeholder="操作人员"
        value={filters.username}
        onChange={e => onChange({ username: e.target.value })}
        prefix={<Search size={16} style={{ color: '#bfbfbf' }} />}
        style={{ width: 200 }}
      />
      <Select
        style={{ width: 160 }}
        value={filters.status || 'all'}
        onChange={v => onChange({ status: v === 'all' ? undefined : v })}
        options={[
          { value: 'all', label: '操作状态(全部)' },
          { value: '成功', label: '成功' },
          { value: '失败', label: '失败' },
        ]}
      />
      <RangePicker value={filters.dateRange} onChange={v => onChange({ dateRange: v })} />
      <Button type="primary" icon={<Search size={16} />} onClick={onApply}>
        搜索
      </Button>
    </Space>
  )
}
