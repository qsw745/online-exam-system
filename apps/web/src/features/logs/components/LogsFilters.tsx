import { DatePicker, Input, Select, Button, Space, Typography } from 'antd'
import { Filter, Search } from 'lucide-react'
import type { LogFilters } from '@/shared/api/endpoints/logs'
import { translate } from '@/shared/utils/i18n'
const { RangePicker } = DatePicker
const { Option } = Select
const { Text } = Typography

export default function LogsFilters({
  filters,
  onChange,
  onApply,
}: {
  filters: LogFilters & { action?: string; username?: string }
  onChange: (patch: Partial<LogFilters & { action?: string; username?: string }>) => void
  onApply: () => void
}) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
        <div>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            {translate('auto.307ac59fee')}</Text>
          <Select value={filters.level} onChange={v => onChange({ level: v })} style={{ width: '100%' }}>
            <Option value="all">{translate('auto.e1e387db60')}</Option>
            <Option value="info">{translate('auto.2da40f4073')}</Option>
            <Option value="warning">{translate('auto.5521e368d8')}</Option>
            <Option value="error">{translate('questions.tf_false')}</Option>
          </Select>
        </div>
        <div>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            {translate('auto.19e41f1bea')}</Text>
          <Input
            value={filters.action}
            onChange={e => onChange({ action: e.target.value })}
            placeholder={translate('auto.305742e1ec')}
            prefix={<Search style={{ width: 16, height: 16, color: '#bfbfbf' }} />}
          />
        </div>
        <div>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            {translate('auth.username')}</Text>
          <Input
            value={filters.username}
            onChange={e => onChange({ username: e.target.value })}
            placeholder={translate('auto.ab34fb52ad')}
            prefix={<Search style={{ width: 16, height: 16, color: '#bfbfbf' }} />}
          />
        </div>
        <div>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            {translate('auto.2be9040878')}</Text>
          <RangePicker
            value={filters.dateRange as any}
            onChange={v => onChange({ dateRange: (v as any) ?? null })}
            format="YYYY-MM-DD"
            style={{ width: '100%' }}
          />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <Button icon={<Filter style={{ width: 16, height: 16 }} />} onClick={onApply}>
          {translate('auto.758c4639c5')}</Button>
      </div>
    </div>
  )
}
