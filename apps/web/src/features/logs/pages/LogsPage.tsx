import LogDetailModal from '@/features/logs/components/LogDetailModal'
import LogsFilters from '@/features/logs/components/LogsFilters'
import LogsTable from '@/features/logs/components/LogsTable'
import AppBreadcrumb from '@/shared/components/AppBreadcrumb'
import { createPaginationConfig } from '@/shared/constants/pagination'
import { useLogs } from '@/shared/hooks/useLogs'
import { Button, Card, Pagination, Space, Typography } from 'antd'
import { Download, FileText } from 'lucide-react'
const { Title } = Typography
// 日志组件
export default function LogsPage() {
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
    detailOpen,
    currentLog,
    openDetail,
    closeDetail,
    exportLogs,
  } = useLogs()

  return (
    <div >
      <AppBreadcrumb />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <Space>
          <FileText style={{ width: 24, height: 24, color: '#1677ff' }} />
          <Title level={2} style={{ margin: 0 }}>
            日志管理
          </Title>
        </Space>
        <Button type="primary" icon={<Download style={{ width: 16, height: 16 }} />} onClick={exportLogs}>
          导出日志
        </Button>
      </div>

      <Card style={{ marginBottom: 24 }}>
        <LogsFilters
          filters={filters}
          onChange={patch => setFilters(prev => ({ ...prev, ...patch }))}
          onApply={() => {
            setPage(1)
            fetchLogs()
          }}
        />
      </Card>

      <Card>
        <LogsTable data={logs} loading={loading} onRowDblClick={openDetail} />
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

      <LogDetailModal open={detailOpen} log={currentLog} onClose={closeDetail} />
    </div>
  )
}
