// apps/web/src/features/logs/hooks/useLogs.ts
import { useCallback, useEffect, useState } from 'react'
import { App } from 'antd'
import dayjs from '@/shared/utils/dayjs'
import { logsApi, type LogEntry } from '@/shared/api/endpoints/logs'
import { translate } from '@/shared/utils/i18n'

export type CommonFilters = {
  level?: 'all' | 'info' | 'warning' | 'error'
  action?: string
  username?: string
  module?: string // ✅ 新增：所属模块（用于操作日志）
  status?: '' | 'success' | 'fail'
  dateRange?: [dayjs.Dayjs, dayjs.Dayjs] | null
}

const defaultFilters: CommonFilters = {
  level: 'all',
  action: '',
  username: '',
  module: '',
  status: '',
  dateRange: null,
}

export function useLogs(type: 'all' | 'login' | 'audit' | 'system' = 'all') {
  const { message } = App.useApp()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const [filters, setFilters] = useState<CommonFilters>(defaultFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const buildParams = (fs: CommonFilters) => {
    const params: any = { ...fs }
    if (fs.dateRange && fs.dateRange[0] && fs.dateRange[1]) {
      params.start = fs.dateRange[0].startOf('day').format('YYYY-MM-DD')
      params.end = fs.dateRange[1].endOf('day').format('YYYY-MM-DD')
    } else {
      params.start = undefined
      params.end = undefined
    }
    delete params.dateRange
    // 各类型特定字段的保留/删减，可根据你后端需要调整
    if (type === 'login') {
      // login: 使用 username/status
    } else if (type === 'audit') {
      // audit: 关注 module/status（如后端需要 module_name，请在 API 层映射）
      // 可以删除 username 等无关字段
      delete params.username
    }
    return params
  }

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true)
      const params = buildParams(filters)
      let ret
      if (type === 'login') ret = await logsApi.listLogin(params, page, pageSize)
      else if (type === 'audit') ret = await logsApi.listAudit(params, page, pageSize)
      else if (type === 'system') ret = await logsApi.listSystem(params, page, pageSize)
      else ret = await logsApi.list(params, page, pageSize)

      setLogs(ret.items)
      setTotal(ret.total)
    } catch (e) {
      console.error(e)
      message.error(translate('auto.f36da5ba46'))
      setLogs([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [filters, page, pageSize, type, message])

  const exportLogs = useCallback(async () => {
    try {
      const params = buildParams(filters)
      const blob = await logsApi.exportCsv(params)
      const url = URL.createObjectURL(new Blob([blob], { type: 'text/csv' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `logs_${dayjs().format('YYYY-MM-DD')}.csv`
      a.click()
      URL.revokeObjectURL(url)
      message.success(translate('auto.ef27c2badc'))
    } catch (e) {
      console.error(e)
      message.error(translate('auto.f610b8f951'))
    }
  }, [filters, message])

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters)
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  return {
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
  }
}

export default useLogs
