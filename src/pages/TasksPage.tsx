import React, { useState, useEffect } from 'react'
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
import LoadingSpinner from '../components/LoadingSpinner'
import Pagination from '../components/ui/Pagination'
import toast from 'react-hot-toast'
import { tasks } from '../lib/api'

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
      toast.error(error.response?.data?.message || '加载任务失败')
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
      toast.error('无法开始此任务')
    }
  }

  if (loading) {
    return <LoadingSpinner text="加载任务列表..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">我的任务</h1>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="搜索任务..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => handleFilterStatusChange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">所有状态</option>
            <option value="not_started">待开始</option>
            <option value="in_progress">进行中</option>
            <option value="completed">已完成</option>
            <option value="expired">已过期</option>
          </select>

          <select
            value={filterType}
            onChange={(e) => handleFilterTypeChange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">所有类型</option>
            <option value="exam">考试</option>
            <option value="practice">练习</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {taskList.map((task) => (
          <div key={task.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">{task.title}</h3>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      task.type === 'exam' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {task.type === 'exam' ? '考试' : '练习'}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${getStatusColor(task.status)}`}>
                    {getStatusIcon(task.status)}
                    <span>{getStatusLabel(task.status)}</span>
                  </span>
                </div>
                
                <p className="text-gray-600 mb-4">{task.description}</p>
                
                <div className="flex items-center space-x-6 text-sm text-gray-500">
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-4 h-4" />
                    <span>开始时间: {new Date(task.start_time).toLocaleString('zh-CN')}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-4 h-4" />
                    <span>结束时间: {new Date(task.end_time).toLocaleString('zh-CN')}</span>
                  </div>
                </div>
              </div>
              
              <div className="ml-6">
                {canStartTask(task) ? (
                  <button
                    onClick={() => handleStartTask(task)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                  >
                    <Play className="w-4 h-4" />
                    <span>开始{task.type === 'exam' ? '考试' : '练习'}</span>
                  </button>
                ) : task.status === 'completed' ? (
                  <button
                    disabled
                    className="px-4 py-2 bg-green-100 text-green-800 rounded-lg cursor-not-allowed flex items-center space-x-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>已完成</span>
                  </button>
                ) : task.status === 'expired' ? (
                  <button
                    disabled
                    className="px-4 py-2 bg-red-100 text-red-800 rounded-lg cursor-not-allowed flex items-center space-x-2"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>已过期</span>
                  </button>
                ) : (
                  <button
                    disabled
                    className="px-4 py-2 bg-gray-100 text-gray-500 rounded-lg cursor-not-allowed flex items-center space-x-2"
                  >
                    <Clock className="w-4 h-4" />
                    <span>未开始</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {taskList.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无任务</h3>
            <p className="text-gray-500">当前筛选条件下没有找到任何任务</p>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalTasks}
            pageSize={pageSize}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  )
}

export default TasksPage