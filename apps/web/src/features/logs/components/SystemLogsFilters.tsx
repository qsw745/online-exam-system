import { DatePicker, Input, Button, Space } from 'antd'
import { Search } from 'lucide-react'
import { translate } from '@/shared/utils/i18n'
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
        placeholder={translate('auto.27713f242f')}
        value={filters.module}
        onChange={e => onChange({ module: e.target.value })}
        prefix={<Search size={16} style={{ color: '#bfbfbf' }} />}
        style={{ width: 240 }}
      />
      <Input
        allowClear
        placeholder={translate('auto.4a30b04730')}
        value={filters.action}
        onChange={e => onChange({ action: e.target.value })}
        prefix={<Search size={16} style={{ color: '#bfbfbf' }} />}
        style={{ width: 260 }}
      />
      <RangePicker value={filters.dateRange} onChange={v => onChange({ dateRange: v })} />
      <Button type="primary" icon={<Search size={16} />} onClick={onApply}>
        {translate('app.search')}</Button>
    </Space>
  )
}
