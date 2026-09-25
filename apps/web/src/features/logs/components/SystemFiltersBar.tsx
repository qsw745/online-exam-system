// apps/web/src/features/logs/components/SystemFiltersBar.tsx
import React from 'react'
import { Button, DatePicker, Input, Space, Typography } from 'antd'
import { Clock } from 'lucide-react'
import type { Dayjs } from 'dayjs'
import dayjs from '@/shared/utils/dayjs'
import { translate } from '@/shared/utils/i18n'

const { Text } = Typography

export type SystemFilters = {
  module?: string
  dateRange?: [Dayjs, Dayjs] | null
}

export default function SystemFiltersBar({
  filters,
  onChange,
  onSearch,
  onReset,
  loading,
}: {
  filters: SystemFilters
  onChange: (patch: Partial<SystemFilters>) => void
  onSearch: () => void
  onReset: () => void
  loading?: boolean
}) {
  const [start, end] = filters.dateRange || [null, null]

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 2.4fr auto auto',
        gap: 16,
        alignItems: 'center',
      }}
    >
      {/* 所属模块 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Text strong style={{ width: 72, textAlign: 'right' }}>
          {translate('auto.27713f242f')}</Text>
        <Input
          allowClear
          placeholder={translate('auto.a64200fdbc')}
          value={filters.module}
          onChange={e => onChange({ module: e.target.value })}
        />
      </div>

      {/* 请求时间：开始 至 结束 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Text strong style={{ width: 72, textAlign: 'right' }}>
          {translate('auto.e8b5eda03a')}</Text>

        <Space.Compact style={{ width: '100%' }}>
          <DatePicker
            value={start || undefined}
            onChange={v => onChange({ dateRange: (v && end ? [v, end] : v ? [v, null] : null) as any })}
            placeholder={translate('auto.88ab31c323')}
            showTime={false}
            format="YYYY-MM-DD"
            style={{ width: '48%' }}
            allowClear
            suffixIcon={<Clock size={16} />}
          />
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', color: '#999' }}>{translate('auto.43401e739e')}</div>
          <DatePicker
            value={end || undefined}
            onChange={v => onChange({ dateRange: (start && v ? [start, v] : v ? [null, v] : null) as any })}
            placeholder={translate('auto.e1a17a6d26')}
            showTime={false}
            format="YYYY-MM-DD"
            style={{ width: '48%' }}
            allowClear
            suffixIcon={<Clock size={16} />}
            disabledDate={current => !!start && current && current.isBefore(dayjs(start).startOf('day'))}
          />
        </Space.Compact>
      </div>

      <Button type="primary" onClick={onSearch} loading={loading}>
        {translate('app.search')}</Button>
      <Button onClick={onReset} disabled={loading}>
        {translate('app.reset')}</Button>
    </div>
  )
}
