import React, { useState, useEffect } from 'react'
import { Card, Table, Select, DatePicker, Input, Tag, Button, Spin, App } from 'antd'
import { FileText, Search, Download, Filter } from 'lucide-react'
import { api } from '../lib/api'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker
const { Option } = Select

interface LogEntry {
  id: number
  log_type: string
  user_id?: number
  username?: string
  action: string
  resource: string
  message?: string
  details?: any
  ip_address: string
  user_agent: string
  level: 'info' | 'warning' | 'error'
  status?: string
  created_at: string
}

export default function LogsPage() {
  const { message } = App.useApp()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [filters, setFilters] = useState({
    level: 'all',
    action: '',
    username: '',
    dateRange: null as [dayjs.Dayjs, dayjs.Dayjs] | null
  })

  useEffect(() => {
    fetchLogs()
  }, [currentPage, pageSize, filters])

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const params = {
        page: currentPage,
        limit: pageSize,
        level: filters.level !== 'all' ? filters.level : undefined,
        action: filters.action || undefined,
        username: filters.username || undefined,
        start_date: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
        end_date: filters.dateRange?.[1]?.format('YYYY-MM-DD')
      }
      
      const response = await api.get('/logs', { params })
      setLogs(response.data || [])
      setTotal(response.data.total || 0)
    } catch (error) {
      console.error('获取日志失败:', error)
      message.error('获取日志失败')
    } finally {
      setLoading(false)
    }
  }

  const exportLogs = async () => {
    try {
      const params = {
        level: filters.level !== 'all' ? filters.level : undefined,
        action: filters.action || undefined,
        username: filters.username || undefined,
        start_date: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
        end_date: filters.dateRange?.[1]?.format('YYYY-MM-DD'),
        format: 'csv'
      }
      
      const response = await api.get('/logs/export', { 
        params,
        responseType: 'blob'
      })
      
      const blob = new Blob([response.data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `logs_${dayjs().format('YYYY-MM-DD')}.csv`
      link.click()
      window.URL.revokeObjectURL(url)
      
      message.success('日志导出成功')
    } catch (error) {
      console.error('导出日志失败:', error)
      message.error('导出日志失败')
    }
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'info': return 'blue'
      case 'warning': return 'orange'
      case 'error': return 'red'
      default: return 'default'
    }
  }

  const getLevelText = (level: string) => {
    switch (level) {
      case 'info': return '信息'
      case 'warning': return '警告'
      case 'error': return '错误'
      default: return level
    }
  }

  const columns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 80,
      render: (level: string) => (
        <Tag color={getLevelColor(level)}>
          {getLevelText(level)}
        </Tag>
      )
    },
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
      width: 120,
      render: (username: string, record: LogEntry) => (
        username ? (
          <div>
            <div className="font-medium">{username}</div>
            <div className="text-xs text-gray-500">ID: {record.user_id}</div>
          </div>
        ) : (
          <span className="text-gray-400">系统</span>
        )
      )
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 150,
      render: (action: string) => (
        <Tag color="purple">{action}</Tag>
      )
    },
    {
      title: '资源',
      dataIndex: 'resource',
      key: 'resource',
      width: 150
    },
    {
      title: '详情',
      dataIndex: 'details',
      key: 'details',
      ellipsis: true,
      render: (details: any) => (
        <span className="text-sm text-gray-600">
          {details ? (typeof details === 'string' ? details : JSON.stringify(details)) : '-'}
        </span>
      )
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 120
    },
    {
      title: '用户代理',
      dataIndex: 'user_agent',
      key: 'user_agent',
      width: 200,
      ellipsis: true,
      render: (userAgent: string) => (
        <span className="text-xs text-gray-500" title={userAgent}>
          {userAgent}
        </span>
      )
    }
  ]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <FileText className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold">日志管理</h1>
        </div>
        <Button 
          type="primary" 
          icon={<Download className="w-4 h-4" />}
          onClick={exportLogs}
        >
          导出日志
        </Button>
      </div>

      {/* 筛选器 */}
      <Card className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              日志级别
            </label>
            <Select
              value={filters.level}
              onChange={(value) => setFilters(prev => ({ ...prev, level: value }))}
              className="w-full"
            >
              <Option value="all">全部级别</Option>
              <Option value="info">信息</Option>
              <Option value="warning">警告</Option>
              <Option value="error">错误</Option>
            </Select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              操作类型
            </label>
            <Input
              placeholder="搜索操作类型"
              value={filters.action}
              onChange={(e) => setFilters(prev => ({ ...prev, action: e.target.value }))}
              prefix={<Search className="w-4 h-4 text-gray-400" />}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              用户名
            </label>
            <Input
              placeholder="搜索用户名"
              value={filters.username}
              onChange={(e) => setFilters(prev => ({ ...prev, username: e.target.value }))}
              prefix={<Search className="w-4 h-4 text-gray-400" />}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              时间范围
            </label>
            <RangePicker
              value={filters.dateRange}
              onChange={(dates) => setFilters(prev => ({ ...prev, dateRange: dates }))}
              format="YYYY-MM-DD"
              className="w-full"
            />
          </div>
        </div>
        
        <div className="flex justify-end mt-4">
          <Button 
            icon={<Filter className="w-4 h-4" />}
            onClick={() => {
              setCurrentPage(1)
              fetchLogs()
            }}
          >
            应用筛选
          </Button>
        </div>
      </Card>

      {/* 日志表格 */}
      <Card>
        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`,
            onChange: (page, size) => {
              setCurrentPage(page)
              setPageSize(size || 20)
            }
          }}
          scroll={{ x: 1200 }}
          size="small"
          rowClassName={(record) => {
            switch (record.level) {
              case 'error': return 'bg-red-50'
              case 'warning': return 'bg-orange-50'
              default: return ''
            }
          }}
        />
      </Card>
    </div>
  )
}