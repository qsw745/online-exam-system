// apps/web/src/features/logs/components/OperationFiltersBar.tsx
import React from 'react'
import { Button, DatePicker, Input, Select, Space, Typography } from 'antd'
import { Clock } from 'lucide-react'
import type { Dayjs } from 'dayjs'
import dayjs from '@/shared/utils/dayjs'

const { Text } = Typography

export type OperationFilters = {
  module?: string
  status?: '' | 'success' | 'fail'
  dateRange?: [Dayjs, Dayjs] | null
}

export default function OperationFiltersBar({
  filters,
  onChange,
  onSearch,
  onReset,
  loading,
}: {
  filters: OperationFilters
  onChange: (patch: Partial<OperationFilters>) => void
  onSearch: () => void
  onReset: () => void
  loading?: boolean
}) {
  const [start, end] = filters.dateRange || [null, null]

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr 2.2fr auto auto',
        gap: 16,
        alignItems: 'center',
      }}
    >
      {/* 所属模块 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Text strong style={{ width: 78, textAlign: 'right' }}>
          所属模块
        </Text>
        <Input
          allowClear
          placeholder="请输入所属模块"
          value={filters.module}
          onChange={e => onChange({ module: e.target.value })}
        />
      </div>

      {/* 操作状态 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Text strong style={{ width: 72, textAlign: 'right' }}>
          操作状态
        </Text>
        <Select
          value={filters.status ?? ''}
          onChange={v => onChange({ status: v })}
          placeholder="请选择"
          options={[
            { value: '', label: '全部' },
            { value: 'success', label: '成功' },
            { value: 'fail', label: '失败' },
          ]}
        />
      </div>

      {/* 操作时间：开始 至 结束 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Text strong style={{ width: 72, textAlign: 'right' }}>
          操作时间
        </Text>

        <Space.Compact style={{ width: '100%' }}>
          <DatePicker
            value={start || undefined}
            onChange={v => onChange({ dateRange: (v && end ? [v, end] : v ? [v, null] : null) as any })}
            placeholder="开始日期时间"
            showTime={false}
            format="YYYY-MM-DD"
            style={{ width: '48%' }}
            allowClear
            suffixIcon={<Clock size={16} />}
          />
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', color: '#999' }}>至</div>
          <DatePicker
            value={end || undefined}
            onChange={v => onChange({ dateRange: (start && v ? [start, v] : v ? [null, v] : null) as any })}
            placeholder="结束日期时间"
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
        搜索
      </Button>
      <Button onClick={onReset} disabled={loading}>
        重置
      </Button>
    </div>
  )
}
