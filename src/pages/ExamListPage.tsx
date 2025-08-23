import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, Filter, Clock, Users, BookOpen, Play } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import LoadingSpinner from '../components/LoadingSpinner'
import { api } from '../lib/api'
import toast from 'react-hot-toast'

interface Exam {
  id: number
  title: string
  description: string
  duration: number
  total_score: number
  status: 'draft' | 'published' | 'archived'
  start_time?: string
  end_time?: string
  created_at: string
  updated_at: string
  question_count?: number
  participant_count?: number
}

interface ExamListResponse {
  exams: Exam[]
  total: number
  page: number
  limit: number
}

export default function ExamListPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [exams, setExams] = useState<Exam[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 10

  // 加载考试列表
  const loadExams = async (page = 1, search = '', status = 'all') => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
        ...(status !== 'all' && { status })
      })
      
      const response = await api.get(`/exams?${params}`)
      
      if (response.data) {
        const data: ExamListResponse = response.data
        setExams(data.exams)
        setTotal(data.total)
        setTotalPages(Math.ceil(data.total / limit))
      } else {
        toast.error(response.data.error || '加载考试列表失败')
      }
    } catch (error) {
      console.error('加载考试列表失败:', error)
      toast.error('加载考试列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadExams(currentPage, searchTerm, filterStatus)
  }, [currentPage, searchTerm, filterStatus])

  // 搜索处理
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    loadExams(1, searchTerm, filterStatus)
  }

  // 筛选处理
  const handleFilterChange = (status: string) => {
    setFilterStatus(status)
    setCurrentPage(1)
    loadExams(1, searchTerm, status)
  }

  // 格式化时间
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}小时${mins > 0 ? mins + '分钟' : ''}`
    }
    return `${mins}分钟`
  }

  // 获取状态标签
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: '草稿', color: 'bg-gray-100 text-gray-800' },
      published: { label: '已发布', color: 'bg-green-100 text-green-800' },
      archived: { label: '已归档', color: 'bg-red-100 text-red-800' }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
        {config.label}
      </span>
    )
  }

  if (loading && exams.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">考试列表</h1>
        <p className="text-gray-600 mt-1">查看和参加可用的考试</p>
      </div>

      {/* 搜索和筛选 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-4 md:space-y-0">
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="搜索考试..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </form>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={filterStatus}
                onChange={(e) => handleFilterChange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">所有状态</option>
                <option value="published">已发布</option>
                <option value="draft">草稿</option>
                <option value="archived">已归档</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 考试列表 */}
      <div className="space-y-4">
        {exams.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无考试</h3>
            <p className="text-gray-600">当前没有可用的考试</p>
          </div>
        ) : (
          exams.map((exam) => (
            <div key={exam.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{exam.title}</h3>
                    {getStatusBadge(exam.status)}
                  </div>
                  
                  {exam.description && (
                    <p className="text-gray-600 mb-4 line-clamp-2">{exam.description}</p>
                  )}
                  
                  <div className="flex items-center space-x-6 text-sm text-gray-500">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4" />
                      <span>{formatDuration(exam.duration)}</span>
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      <BookOpen className="w-4 h-4" />
                      <span>{exam.total_score}分</span>
                    </div>
                    
                    {exam.question_count && (
                      <div className="flex items-center space-x-1">
                        <span>{exam.question_count}题</span>
                      </div>
                    )}
                    
                    {exam.participant_count !== undefined && (
                      <div className="flex items-center space-x-1">
                        <Users className="w-4 h-4" />
                        <span>{exam.participant_count}人参加</span>
                      </div>
                    )}
                  </div>
                  
                  {(exam.start_time || exam.end_time) && (
                    <div className="mt-3 text-sm text-gray-500">
                      {exam.start_time && (
                        <div>开始时间: {new Date(exam.start_time).toLocaleString()}</div>
                      )}
                      {exam.end_time && (
                        <div>结束时间: {new Date(exam.end_time).toLocaleString()}</div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="ml-6">
                  {exam.status === 'published' ? (
                    <Link
                      to={`/exam/${exam.id}`}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Play className="w-4 h-4" />
                      <span>开始考试</span>
                    </Link>
                  ) : (
                    <button
                      disabled
                      className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-400 rounded-lg cursor-not-allowed"
                    >
                      <span>暂不可用</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-600">
            共 {total} 个考试，第 {currentPage} / {totalPages} 页
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一页
            </button>
            
            <span className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded">
              {currentPage}
            </span>
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  )
}