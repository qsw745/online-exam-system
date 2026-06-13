import React from 'react'
import { Button, DatePicker, Input, Select, Space, Typography } from 'antd'
import { Clock } from 'lucide-react'
import type { Dayjs } from 'dayjs'
import dayjs from '@/shared/utils/dayjs'

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
          用户名
        </Text>
        <Input
          allowClear
          placeholder="请输入用户名"
          value={filters.username}
          onChange={e => onChange({ username: e.target.value })}
        />
      </div>

      {/* 登录状态 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Text strong style={{ width: 64, textAlign: 'right' }}>
          登录状态
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

      {/* 登录时间：开始 至 结束 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Text strong style={{ width: 68, textAlign: 'right' }}>
          登录时间
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

      {/* 搜索 */}
      <Button type="primary" onClick={onSearch} loading={loading}>
        搜索
      </Button>

      {/* 重置 */}
      <Button onClick={onReset} disabled={loading}>
        重置
      </Button>
    </div>
  )
}
