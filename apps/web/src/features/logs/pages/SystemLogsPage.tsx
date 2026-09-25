// apps/web/src/features/logs/pages/SystemLogsPage.tsx
import React from 'react'
import { Button, Card, Space, Typography } from 'antd'
import { Cpu, Download } from 'lucide-react'
import SystemFiltersBar from '@/features/logs/components/SystemFiltersBar'
import SystemLogsTable from '@/features/logs/components/SystemLogsTable'
import { useLogs } from '@/features/logs/hooks/useLogs'
import GlobalPagination from '@/shared/components/GlobalPagination'
import { translate } from '@/shared/utils/i18n'

const { Title } = Typography

// 本页需要的默认筛选（与 useLogs 里一致即可）
const DEFAULT_FILTERS = {
  level: 'all' as const,
  action: '',
  username: '',
  module: '',
  status: '' as '' | 'success' | 'fail',
  dateRange: null as any,
}

export default function SystemLogsPage() {
  const {
    logs,
    total,
    loading,
    filters,
    setFilters,
    page,
    setPage,
    pageSize,
    setPageSize,
    fetchLogs,
    exportLogs,
    resetFilters, // 有则用；没有就用 DEFAULT_FILTERS
  } = useLogs('system')

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space>
          <Cpu style={{ width: 22, height: 22, color: '#1677ff' }} />
          <Title level={2} style={{ margin: 0 }}>
            {translate('menus.system-logs-system')}</Title>
        </Space>
        <Button type="primary" icon={<Download style={{ width: 16, height: 16 }} />} onClick={exportLogs}>
          {translate('questions.export')}</Button>
      </div>

      <Card style={{ marginBottom: 12,  }}>
        <SystemFiltersBar
          filters={filters as any}
          onChange={patch => setFilters(prev => ({ ...prev, ...patch }))}
          onSearch={() => {
            setPage(1)
            fetchLogs()
          }}
          onReset={() => {
            if (resetFilters) {
              resetFilters() // ✅ 直接调用
            } else {
              setFilters(DEFAULT_FILTERS) // ✅ 没有就手动重置
            }
            setPage(1)
            fetchLogs()
          }}
          loading={loading}
        />
      </Card>

      <Card>
        <SystemLogsTable data={logs} loading={loading} />
        {!loading && (
          <GlobalPagination
            total={total}
            current={page}
            pageSize={pageSize}
            onChange={(p, size) => {
              setPage(p)
              setPageSize(size)
            }}
          />
        )}
      </Card>
    </div>
  )
}
