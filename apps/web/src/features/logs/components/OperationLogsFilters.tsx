import { DatePicker, Input, Select, Button, Space } from 'antd'
import { Search } from 'lucide-react'
import { translate } from '@/shared/utils/i18n'
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
        placeholder={translate('auto.27713f242f')}
        value={filters.module}
        onChange={e => onChange({ module: e.target.value })}
        prefix={<Search size={16} style={{ color: '#bfbfbf' }} />}
        style={{ width: 240 }}
      />
      <Input
        allowClear
        placeholder={translate('auto.ae0849ff19')}
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
          { value: 'all', label: translate('auto.e29f2a84e7') },
          { value: translate('auto.51991a5d11'), label: translate('auto.51991a5d11') },
          { value: translate('auto.3e3c8068bb'), label: translate('auto.3e3c8068bb') },
        ]}
      />
      <RangePicker value={filters.dateRange} onChange={v => onChange({ dateRange: v })} />
      <Button type="primary" icon={<Search size={16} />} onClick={onApply}>
        {translate('app.search')}</Button>
    </Space>
  )
}
