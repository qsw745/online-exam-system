import React from 'react'
import { Button, DatePicker, Input, Select, Space, Typography } from 'antd'
import { Clock } from 'lucide-react'
import type { Dayjs } from 'dayjs'
import dayjs from '@/shared/utils/dayjs'
import { translate } from '@/shared/utils/i18n'

const { RangePicker } = DatePicker
const { Text } = Typography

export type LoginFilters = {
  username?: string
  status?: '' | 'success' | 'fail'
  dateRange?: [Dayjs, Dayjs] | null
}

export default function LoginFiltersBar({
  filters,
  onChange,
  onSearch,
  onReset,
  loading,
}: {
  filters: LoginFilters
  onChange: (patch: Partial<LoginFilters>) => void
  onSearch: () => void
  onReset: () => void
  loading?: boolean
}) {
  const [start, end] = filters.dateRange || [null, null]

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 2fr auto auto',
        gap: 16,
        alignItems: 'center',
      }}
    >
      {/* 用户名 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Text strong style={{ width: 64, textAlign: 'right' }}>
          {translate('auth.username')}</Text>
        <Input
          allowClear
          placeholder={translate('auto.ad5f05f1cf')}
          value={filters.username}
          onChange={e => onChange({ username: e.target.value })}
        />
      </div>

      {/* 登录状态 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Text strong style={{ width: 64, textAlign: 'right' }}>
          {translate('auto.854597d2b1')}</Text>
        <Select
          value={filters.status ?? ''}
          onChange={v => onChange({ status: v })}
          placeholder={translate('users.filters.status_placeholder')}
          options={[
            { value: '', label: translate('auto.778fc8f994') },
            { value: 'success', label: translate('auto.51991a5d11') },
            { value: 'fail', label: translate('auto.3e3c8068bb') },
          ]}
        />
      </div>

      {/* 登录时间：开始 至 结束 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Text strong style={{ width: 68, textAlign: 'right' }}>
          {translate('auto.570df2c0f9')}</Text>

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

      {/* 搜索 */}
      <Button type="primary" onClick={onSearch} loading={loading}>
        {translate('app.search')}</Button>

      {/* 重置 */}
      <Button onClick={onReset} disabled={loading}>
        {translate('app.reset')}</Button>
    </div>
  )
}
