import { DatePicker, Input, Select, Button, Space, Typography } from 'antd'
import { Filter, Search } from 'lucide-react'
import type { LogFilters } from '@shared/api/endpoints/logs'
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
            日志级别
          </Text>
          <Select value={filters.level} onChange={v => onChange({ level: v })} style={{ width: '100%' }}>
            <Option value="all">全部级别</Option>
            <Option value="info">信息</Option>
            <Option value="warning">警告</Option>
            <Option value="error">错误</Option>
          </Select>
        </div>
        <div>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            操作类型
          </Text>
          <Input
            value={filters.action}
            onChange={e => onChange({ action: e.target.value })}
            placeholder="搜索操作类型"
            prefix={<Search style={{ width: 16, height: 16, color: '#bfbfbf' }} />}
          />
        </div>
        <div>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            用户名
          </Text>
          <Input
            value={filters.username}
            onChange={e => onChange({ username: e.target.value })}
            placeholder="搜索用户名"
            prefix={<Search style={{ width: 16, height: 16, color: '#bfbfbf' }} />}
          />
        </div>
        <div>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            时间范围
          </Text>
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
          应用筛选
        </Button>
      </div>
    </div>
  )
}
