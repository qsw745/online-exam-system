// apps/web/src/features/logs/pages/OperationLogsPage.tsx
import React from 'react'
import { Button, Card, Pagination, Space, Typography } from 'antd'
import { Download, Activity } from 'lucide-react'
import OperationFiltersBar from '@/features/logs/components/OperationFiltersBar'
import OperationLogsTable from '@/features/logs/components/OperationLogsTable'
import { createPaginationConfig } from '@/shared/constants/pagination'
import { useLogs } from '@/features/logs/hooks/useLogs'

const { Title } = Typography

export default function OperationLogsPage() {
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
  } = useLogs('audit')

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space>
          <Activity style={{ width: 22, height: 22, color: '#1677ff' }} />
          <Title level={2} style={{ margin: 0 }}>
            操作日志
          </Title>
        </Space>
        <Button type="primary" icon={<Download style={{ width: 16, height: 16 }} />} onClick={exportLogs}>
          导出
        </Button>
      </div>

      {/* 顶部横向筛选条（所属模块 / 操作状态 / 操作时间） */}
      <Card style={{ marginBottom: 12,  }}>
        <OperationFiltersBar
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
        <OperationLogsTable data={logs} loading={loading} page={page} pageSize={pageSize} />
        {!loading && (
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <Pagination
              {...createPaginationConfig()}
              current={page}
              total={total}
              pageSize={pageSize}
              onChange={(p, size) => {
                setPage(p)
                if (size && size !== pageSize) {
                  setPageSize(size)
                  setPage(1)
                }
              }}
              onShowSizeChange={(_, size) => {
                setPageSize(size)
                setPage(1)
              }}
            />
          </div>
        )}
      </Card>
    </div>
  )
}
