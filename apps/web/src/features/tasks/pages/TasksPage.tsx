import React, { useState, useEffect } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { 
  Search, 
  Calendar,
  Clock,
  BookOpen,
  Play,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Spin, Card, Input, Select, Button, Space, Tag, Empty, Typography, Pagination } from 'antd'
import { message } from 'antd'
import { tasks } from '../lib/api'
import { createPaginationConfig } from '../constants/pagination'
const { Title, Text } = Typography

interface Task {
  id: string
  title: string
  description: string
  start_time: string
  end_time: string
  status: 'not_started' | 'in_progress' | 'completed' | 'expired'
  type: 'exam' | 'practice'
  exam_id?: number
  created_at: string
  updated_at: string
}

const TasksPage: React.FC = () => {
  const { t, language } = useLanguage()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [taskList, setTaskList] = useState<Task[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalTasks, setTotalTasks] = useState(0)
  const [pageSize] = useState(10)

  useEffect(() => {
    loadTasks()
  }, [currentPage, searchTerm, filterStatus, filterType])

  const loadTasks = async () => {
    try {
      setLoading(true)
      const params = {
        page: currentPage,
        limit: pageSize,
        search: searchTerm || undefined,
        status: filterStatus === 'all' ? undefined : filterStatus,
        type: filterType === 'all' ? undefined : filterType
      }
      const response = await tasks.list(params)
      
      if (response.data && response.data.tasks) {
        setTaskList(response.data.tasks)
        if (response.data.pagination) {
          setTotalPages(response.data.pagination.totalPages)
          setTotalTasks(response.data.pagination.total)
        }
      } else {
        setTaskList(response.data || [])
      }
    } catch (error: any) {
      console.error('加载任务错误:', error)
      message.error(error.response?.data?.message || '加载任务失败')
      setTaskList([])
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    setCurrentPage(1)
  }

  const handleFilterStatusChange = (value: string) => {
    setFilterStatus(value)
    setCurrentPage(1)
  }

  const handleFilterTypeChange = (value: string) => {
    setFilterType(value)
    setCurrentPage(1)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'not_started':
        return 'bg-yellow-100 text-yellow-800'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'expired':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'not_started':
        return '待开始'
      case 'in_progress':
        return '进行中'
      case 'completed':
        return '已完成'
      case 'expired':
        return '已过期'
      default:
        return status
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'not_started':
        return <Clock className="w-4 h-4" />
      case 'in_progress':
        return <Play className="w-4 h-4" />
      case 'completed':
        return <CheckCircle className="w-4 h-4" />
      case 'expired':
        return <XCircle className="w-4 h-4" />
      default:
        return <AlertCircle className="w-4 h-4" />
    }
  }

  const canStartTask = (task: Task) => {
    const now = new Date()
    const startTime = new Date(task.start_time)
    const endTime = new Date(task.end_time)
    
    return task.status === 'not_started' && now >= startTime && now <= endTime
  }

  const handleStartTask = (task: Task) => {
    if (task.type === 'exam' && task.exam_id) {
      navigate(`/exam/${task.id}`)
    } else {
      message.error('无法开始此任务')
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Spin size="large" tip={t('tasks.loading')}>
          <div style={{ minHeight: '200px',minWidth:"200px" }} />
        </Spin>
      </div>
    )
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Title level={2} style={{ margin: 0 }}>我的任务</Title>
        <Text type="secondary">查看和管理您的考试和练习任务</Text>
      </Card>

      <Card>
        <Space wrap style={{ width: '100%' }}>
          <Input
            prefix={<Search style={{ width: 16, height: 16, color: '#999' }} />}
            placeholder="搜索任务..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
          <Select
            value={filterStatus}
            onChange={handleFilterStatusChange}
            style={{ width: 120 }}
          >
            <Select.Option value="all">所有状态</Select.Option>
            <Select.Option value="not_started">待开始</Select.Option>
            <Select.Option value="in_progress">进行中</Select.Option>
            <Select.Option value="completed">已完成</Select.Option>
            <Select.Option value="expired">已过期</Select.Option>
          </Select>
          <Select
            value={filterType}
            onChange={handleFilterTypeChange}
            style={{ width: 120 }}
          >
            <Select.Option value="all">所有类型</Select.Option>
            <Select.Option value="exam">考试</Select.Option>
            <Select.Option value="practice">练习</Select.Option>
          </Select>
        </Space>
      </Card>

      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {taskList.map((task) => (
          <Card key={task.id}>
            <Space style={{ width: '100%' }} align="start">
              <div style={{ flex: 1 }}>
                <Space wrap style={{ marginBottom: 8 }}>
                  <Title level={4} style={{ margin: 0 }}>{task.title}</Title>
                  <Tag color={task.type === 'exam' ? 'red' : 'blue'}>
                    {task.type === 'exam' ? '考试' : '练习'}
                  </Tag>
                  <Tag 
                    color={
                      task.status === 'not_started' ? 'gold' :
                      task.status === 'in_progress' ? 'blue' :
                      task.status === 'completed' ? 'green' :
                      task.status === 'expired' ? 'red' : 'default'
                    }
                    icon={getStatusIcon(task.status)}
                  >
                    {getStatusLabel(task.status)}
                  </Tag>
                </Space>
                
                <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                  {task.description}
                </Text>
                
                <Space direction="vertical" size="small">
                  <Space>
                    <Calendar style={{ width: 16, height: 16 }} />
                    <Text type="secondary">开始时间: {new Date(task.start_time).toLocaleString('zh-CN')}</Text>
                  </Space>
                  <Space>
                    <Calendar style={{ width: 16, height: 16 }} />
                    <Text type="secondary">结束时间: {new Date(task.end_time).toLocaleString('zh-CN')}</Text>
                  </Space>
                </Space>
              </div>
              
              <div>
                {canStartTask(task) ? (
                  <Button
                    type="primary"
                    onClick={() => handleStartTask(task)}
                    icon={<Play style={{ width: 16, height: 16 }} />}
                  >
                    开始{task.type === 'exam' ? '考试' : '练习'}
                  </Button>
                ) : task.status === 'completed' ? (
                  <Button
                    disabled
                    style={{ color: '#52c41a', borderColor: '#52c41a', backgroundColor: '#f6ffed' }}
                    icon={<CheckCircle style={{ width: 16, height: 16 }} />}
                  >
                    已完成
                  </Button>
                ) : task.status === 'expired' ? (
                  <Button
                    disabled
                    style={{ color: '#ff4d4f', borderColor: '#ff4d4f', backgroundColor: '#fff2f0' }}
                    icon={<XCircle style={{ width: 16, height: 16 }} />}
                  >
                    已过期
                  </Button>
                ) : (
                  <Button
                    disabled
                    icon={<Clock style={{ width: 16, height: 16 }} />}
                  >
                    未开始
                  </Button>
                )}
              </div>
            </Space>
          </Card>
        ))}

        {taskList.length === 0 && (
          <Empty
            image={<BookOpen style={{ width: 48, height: 48, color: '#d9d9d9' }} />}
            description={
              <Space direction="vertical">
                <Text strong>暂无任务</Text>
                <Text type="secondary">当前筛选条件下没有找到任何任务</Text>
              </Space>
            }
          />
        )}
      </Space>

      {totalPages > 1 && (
        <Card>
          <Pagination
            current={currentPage}
            total={totalTasks}
            pageSize={pageSize}
            onChange={handlePageChange}
            {...createPaginationConfig({
              showSizeChanger: false
            })}
          />
        </Card>
      )}
    </Space>
  )
}

export default TasksPage