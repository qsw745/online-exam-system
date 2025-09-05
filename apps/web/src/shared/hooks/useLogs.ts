import { useCallback, useEffect, useMemo, useState } from 'react'
import { App } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { logsApi, type LogEntry, type LogFilters } from '@shared/api/endpoints/logs'

export function useLogs() {
  const { message } = App.useApp()

  // 基础状态
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  // 筛选 & 分页
  const [filters, setFilters] = useState<LogFilters>({
    level: 'all',
    action: '',
    username: '',
    dateRange: null,
  })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // 详情
  const [detailOpen, setDetailOpen] = useState(false)
  const [currentLog, setCurrentLog] = useState<LogEntry | null>(null)

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true)
      const { items, total } = await logsApi.list(filters, page, pageSize)
      setLogs(items)
      setTotal(total)
    } catch (e) {
      console.error(e)
      message.error('获取日志失败')
      setLogs([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [filters, page, pageSize, message])

  const exportLogs = useCallback(async () => {
    try {
      const blob = await logsApi.exportCsv(filters)
      const url = URL.createObjectURL(new Blob([blob], { type: 'text/csv' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `logs_${dayjs().format('YYYY-MM-DD')}.csv`
      a.click()
      URL.revokeObjectURL(url)
      message.success('日志导出成功')
    } catch (e) {
      console.error(e)
      message.error('导出日志失败')
    }
  }, [filters, message])

  const openDetail = useCallback((log: LogEntry) => {
    setCurrentLog(log)
    setDetailOpen(true)
  }, [])
  const closeDetail = useCallback(() => {
    setDetailOpen(false)
    setCurrentLog(null)
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  return {
    // data
    logs,
    total,
    loading,
    // filters & paging
    filters,
    setFilters,
    page,
    setPage,
    pageSize,
    setPageSize,
    fetchLogs,
    // detail
    detailOpen,
    currentLog,
    openDetail,
    closeDetail,
    // actions
    exportLogs,
  }
}
