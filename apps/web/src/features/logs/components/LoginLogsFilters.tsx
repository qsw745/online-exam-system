import { DatePicker, Input, Select, Button, Space } from 'antd'
import { Search } from 'lucide-react'
const { RangePicker } = DatePicker

export default function LoginLogsFilters({
  filters,
  onChange,
  onApply,
}: {
  filters: any
  onChange: (patch: any) => void
  onApply: () => void
}) {
  return (
    <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
      <Input
        allowClear
        placeholder="用户名"
        value={filters.username}
        onChange={e => onChange({ username: e.target.value })}
        prefix={<Search size={16} style={{ color: '#bfbfbf' }} />}
        style={{ width: 240 }}
      />
      <Select
        style={{ width: 160 }}
        value={filters.status || 'all'}
        onChange={v => onChange({ status: v === 'all' ? undefined : v })}
        options={[
          { value: 'all', label: '登录状态(全部)' },
          { value: '成功', label: '成功' },
          { value: '失败', label: '失败' },
        ]}
      />
      <RangePicker
        value={filters.dateRange}
        onChange={v => onChange({ dateRange: v })}
        placeholder={['开始日期', '结束日期']}
      />
      <Button type="primary" icon={<Search size={16} />} onClick={onApply}>
        搜索
      </Button>
    </Space>
  )
}
