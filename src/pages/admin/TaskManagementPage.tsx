import React, { useState, useEffect } from 'react'
import { 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Eye, 
  BookOpen,
  AlertCircle,
  CheckCircle,
  X,
  ClipboardList
} from 'lucide-react'
import Pagination from '../../components/ui/Pagination'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import LoadingSpinner from '../../components/LoadingSpinner'
import toast from 'react-hot-toast'
import * as apiModule from '../../lib/api'

interface Task {
  id: string
  title: string
  description: string
  start_time: string
  end_time: string
  status: 'not_started' | 'in_progress' | 'completed' | 'expired'
  type?: 'exam' | 'practice'
  exam_id?: number
  username?: string
  email?: string
  created_at: string
  updated_at: string
}

const TaskManagementPage: React.FC = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<Task[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalTasks, setTotalTasks] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    loadTasks()
  }, [currentPage, searchTerm, filterStatus, pageSize])

  const loadTasks = async () => {
    try {
      setLoading(true)
      const params = {
        page: currentPage,
        limit: pageSize,
        search: searchTerm || undefined,
        status: filterStatus === 'all' ? undefined : filterStatus
      }
      const response = await apiModule.tasks.list(params)
      
      // 处理响应数据
      if (response.data && response.data.tasks) {
        setTasks(response.data.tasks)
        // 处理分页信息
        if (response.data.pagination) {
          setTotalPages(response.data.pagination.totalPages)
          setTotalTasks(response.data.pagination.total)
        }
      } else {
        setTasks(response.data || [])
      }
    } catch (error: any) {
      console.error('加载任务错误:', error)
      toast.error(error.response?.data?.message || '加载任务失败')
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (taskId: string) => {
    try {
      await apiModule.tasks.delete(taskId)
      toast.success('任务删除成功')
      loadTasks()
      setShowDeleteModal(false)
      setSelectedTask(null)
    } catch (error: any) {
      console.error('删除任务错误:', error)
      toast.error(error.response?.data?.message || '删除任务失败')
    }
  }

  // 分页控制函数
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  // 搜索和筛选的防抖处理
  const handleSearch = (value: string) => {
    setSearchTerm(value)
    setCurrentPage(1) // 重置到第一页
  }

  const handleFilterChange = (value: string) => {
    setFilterStatus(value)
    setCurrentPage(1) // 重置到第一页
  }

  // 移除客户端过滤逻辑，现在使用服务端分页

  const getStatusLabel = (status: string) => {
    const statusMap = {
      'not_started': '待开始',
      'pending': '待开始', // 兼容旧数据
      'in_progress': '进行中',
      'completed': '已完成',
      'expired': '已过期'
    }
    return statusMap[status as keyof typeof statusMap] || status
  }

  const getStatusColor = (status: string) => {
    const colorMap = {
      'not_started': 'bg-yellow-100 text-yellow-800',
      'pending': 'bg-yellow-100 text-yellow-800', // 兼容旧数据
      'in_progress': 'bg-blue-100 text-blue-800',
      'completed': 'bg-green-100 text-green-800',
      'expired': 'bg-red-100 text-red-800'
    }
    return colorMap[status as keyof typeof colorMap] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return <LoadingSpinner text="加载任务列表..." />
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">任务管理</h1>
        <p className="text-gray-600 mt-1">管理所有考试任务</p>
      </div>

      {/* 操作栏 */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="flex flex-1 gap-4">
          {/* 搜索框 */}
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

          {/* 筛选器 */}
          <select
            value={filterStatus}
                onChange={(e) => handleFilterChange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">所有状态</option>
            <option value="not_started">待开始</option>
            <option value="in_progress">进行中</option>
            <option value="completed">已完成</option>
            <option value="expired">已过期</option>
          </select>
        </div>

        {/* 添加按钮 */}
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          onClick={() => navigate('/admin/task-create')}
        >
          <Plus className="w-5 h-5" />
          添加任务
        </button>
      </div>

      {/* 任务列表 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">任务</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">分配用户</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">开始时间</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">结束时间</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建时间</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tasks.map((task) => (
                <tr key={task.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 font-medium">{task.title}</div>
                    <div className="text-sm text-gray-500">{task.description}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{task.username || '未知用户'}</div>
                    <div className="text-sm text-gray-500">{task.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(task.status)}`}>
                      {getStatusLabel(task.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(task.start_time).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(task.end_time).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(task.created_at).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button
                      className="text-blue-600 hover:text-blue-900"
                      onClick={() => navigate(`/admin/task-detail/${task.id}`)}
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button
                      className="text-green-600 hover:text-green-900"
                      onClick={() => navigate(`/admin/task-edit/${task.id}`)}
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      className="text-red-600 hover:text-red-900"
                      onClick={() => {
                        setSelectedTask(task)
                        setShowDeleteModal(true)
                      }}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}

              {tasks.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    <ClipboardList className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    暂无任务
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* 增强版分页组件 */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalTasks}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newPageSize) => {
            setPageSize(newPageSize)
            setCurrentPage(1) // 重置到第一页
          }}
          showSizeChanger={true}
          showQuickJumper={true}
          showTotal={true}
          pageSizeOptions={[10, 20, 50, 100]}
          size="default"
        />
      </div>

      {/* 删除确认对话框 */}
      {showDeleteModal && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">确认删除</h3>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-600 mb-4">
              确定要删除任务 {selectedTask.title}？此操作无法撤销。
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(selectedTask.id)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TaskManagementPage