import React from 'react'
import { Button, Card, Space, Typography } from 'antd'
import { Download, LogIn } from 'lucide-react'
import LoginFiltersBar from '@/features/logs/components/LoginFiltersBar'
import LoginLogsTable from '@/features/logs/components/LoginLogsTable'
import { useLogs } from '@/features/logs/hooks/useLogs'
import GlobalPagination from '@/shared/components/GlobalPagination'
import { translate } from '@/shared/utils/i18n'

const { Title } = Typography

export default function LoginLogsPage() {
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
    resetFilters,
  } = useLogs('login')

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space>
          <LogIn style={{ width: 22, height: 22, color: '#1677ff' }} />
          <Title level={2} style={{ margin: 0 }}>
            {translate('menus.system-logs-login')}</Title>
        </Space>
        <Button type="primary" icon={<Download style={{ width: 16, height: 16 }} />} onClick={exportLogs}>
          {translate('questions.export')}</Button>
      </div>

      {/* 顶部横向筛选条（与截图一致） */}
      <Card style={{ marginBottom: 12, }}>
        <LoginFiltersBar
          filters={filters as any}
          onChange={patch => setFilters(prev => ({ ...prev, ...patch }))}
          onSearch={() => {
            setPage(1)
            fetchLogs()
          }}
          onReset={() => {
            resetFilters()
            setPage(1)
            fetchLogs()
          }}
          loading={loading}
        />
      </Card>

      <Card>
        <LoginLogsTable data={logs} loading={loading} page={page} pageSize={pageSize} />
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
