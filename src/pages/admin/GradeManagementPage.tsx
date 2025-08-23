import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { Search, Filter, Eye, Download, Users, Trophy, TrendingUp, Calendar } from 'lucide-react'
import LoadingSpinner from '../../components/LoadingSpinner'
import toast from 'react-hot-toast'
import { api } from '../../lib/api'

interface StudentResult {
  id: string
  student_id: string
  student_name: string
  student_email: string
  paper_id: string
  paper_title: string
  score: number
  total_score: number
  percentage: number
  start_time: string
  end_time: string
  duration: number
  status: string
  created_at: string
}

interface GradeStats {
  totalStudents: number
  totalExams: number
  averageScore: number
  passRate: number
}

interface State {
  results: StudentResult[]
  stats: GradeStats | null
  loading: boolean
  searchTerm: string
  filterPaper: string
  filterStatus: string
  currentPage: number
  totalPages: number
  totalResults: number
  pageSize: number
  papers: Array<{ id: string; title: string }>
}

const GradeManagementPage: React.FC = () => {
  const { user } = useAuth()
  const [state, setState] = useState<State>({
    results: [],
    stats: null,
    loading: true,
    searchTerm: '',
    filterPaper: 'all',
    filterStatus: 'all',
    currentPage: 1,
    totalPages: 1,
    totalResults: 0,
    pageSize: 15,
    papers: []
  })

  useEffect(() => {
    loadData()
  }, [state.currentPage, state.searchTerm, state.filterPaper, state.filterStatus])

  useEffect(() => {
    loadPapers()
    loadStats()
  }, [])

  const loadData = async () => {
    try {
      setState(prev => ({ ...prev, loading: true }))
      const { data } = await api.get('/exam_results', {
        params: {
          page: state.currentPage,
          limit: state.pageSize,
          paper_id: state.filterPaper === 'all' ? undefined : state.filterPaper,
          status: state.filterStatus === 'all' ? undefined : state.filterStatus,
          search: state.searchTerm || undefined,
          include_student_info: true
        }
      })
      
      setState(prev => ({
        ...prev,
        results: data.results || [],
        totalPages: data.pagination?.totalPages || 1,
        totalResults: data.pagination?.total || 0,
        loading: false
      }))
    } catch (error: any) {
      console.error('加载成绩数据错误:', error)
      toast.error(error.response?.data?.message || '加载成绩数据失败')
      setState(prev => ({ ...prev, loading: false }))
    }
  }

  const loadPapers = async () => {
    try {
      const { data } = await api.get('/papers')
      setState(prev => ({ ...prev, papers: data.papers || [] }))
    } catch (error: any) {
      console.error('加载试卷列表错误:', error)
    }
  }

  const loadStats = async () => {
    try {
      const { data } = await api.get('/analytics/grade-stats')
      setState(prev => ({ ...prev, stats: data }))
    } catch (error: any) {
      console.error('加载统计数据错误:', error)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setState(prev => ({ ...prev, currentPage: 1 }))
  }

  const handleFilterChange = (type: 'paper' | 'status', value: string) => {
    setState(prev => ({ 
      ...prev, 
      [type === 'paper' ? 'filterPaper' : 'filterStatus']: value,
      currentPage: 1 
    }))
  }

  const handlePageChange = (page: number) => {
    setState(prev => ({ ...prev, currentPage: page }))
  }

  const exportResults = async () => {
    try {
      const { data } = await api.get('/exam_results/export', {
        params: {
          paper_id: state.filterPaper === 'all' ? undefined : state.filterPaper,
          status: state.filterStatus === 'all' ? undefined : state.filterStatus,
          search: state.searchTerm || undefined
        },
        responseType: 'blob'
      })
      
      const url = window.URL.createObjectURL(new Blob([data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `成绩报告_${new Date().toISOString().split('T')[0]}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      
      toast.success('成绩报告导出成功')
    } catch (error: any) {
      console.error('导出成绩报告错误:', error)
      toast.error('导出成绩报告失败')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50'
      case 'in_progress': return 'text-blue-600 bg-blue-50'
      case 'not_started': return 'text-gray-600 bg-gray-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return '已完成'
      case 'in_progress': return '进行中'
      case 'not_started': return '未开始'
      default: return '未知'
    }
  }

  const getScoreColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600'
    if (percentage >= 80) return 'text-blue-600'
    if (percentage >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (state.loading && state.results.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">成绩管理</h1>
        <p className="text-gray-600">查看和管理学生考试成绩</p>
      </div>

      {/* 统计卡片 */}
      {state.stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-50 mr-4">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">参与学生</p>
                <p className="text-2xl font-bold text-gray-900">{state.stats.totalStudents}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-50 mr-4">
                <Trophy className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">考试总数</p>
                <p className="text-2xl font-bold text-gray-900">{state.stats.totalExams}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-yellow-50 mr-4">
                <TrendingUp className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">平均分</p>
                <p className="text-2xl font-bold text-gray-900">{state.stats.averageScore.toFixed(1)}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-purple-50 mr-4">
                <Calendar className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">及格率</p>
                <p className="text-2xl font-bold text-gray-900">{state.stats.passRate.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 搜索和筛选 */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="搜索学生姓名或邮箱..."
                value={state.searchTerm}
                onChange={(e) => setState(prev => ({ ...prev, searchTerm: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </form>
          
          <div className="flex gap-4">
            <select
              value={state.filterPaper}
              onChange={(e) => handleFilterChange('paper', e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">所有试卷</option>
              {state.papers.map(paper => (
                <option key={paper.id} value={paper.id}>{paper.title}</option>
              ))}
            </select>
            
            <select
              value={state.filterStatus}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">所有状态</option>
              <option value="completed">已完成</option>
              <option value="in_progress">进行中</option>
              <option value="not_started">未开始</option>
            </select>
            
            <button
              onClick={exportResults}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              导出
            </button>
          </div>
        </div>
      </div>

      {/* 成绩列表 */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  学生信息
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  试卷
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  成绩
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  用时
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  提交时间
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {state.results.map((result) => (
                <tr key={result.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {result.student_name || '未知学生'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {result.student_email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 max-w-xs truncate">
                      {result.paper_title}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">
                      <span className={`font-medium ${getScoreColor(result.percentage)}`}>
                        {result.score}/{result.total_score}
                      </span>
                      <div className="text-xs text-gray-500">
                        {result.percentage.toFixed(1)}%
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {result.duration ? `${Math.floor(result.duration / 60)}分${result.duration % 60}秒` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(result.status)}`}>
                      {getStatusText(result.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(result.created_at).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button className="text-blue-600 hover:text-blue-900 flex items-center gap-1">
                      <Eye className="h-4 w-4" />
                      查看详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {state.results.length === 0 && !state.loading && (
          <div className="text-center py-12">
            <Trophy className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">暂无成绩数据</h3>
            <p className="mt-1 text-sm text-gray-500">还没有学生提交考试成绩</p>
          </div>
        )}
      </div>

      {/* 分页 */}
      {state.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            显示第 {(state.currentPage - 1) * state.pageSize + 1} - {Math.min(state.currentPage * state.pageSize, state.totalResults)} 条，
            共 {state.totalResults} 条记录
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handlePageChange(state.currentPage - 1)}
              disabled={state.currentPage === 1}
              className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一页
            </button>
            
            {Array.from({ length: Math.min(5, state.totalPages) }, (_, i) => {
              const page = i + Math.max(1, state.currentPage - 2)
              if (page > state.totalPages) return null
              return (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`px-3 py-2 text-sm font-medium rounded-md ${
                    page === state.currentPage
                      ? 'text-blue-600 bg-blue-50 border border-blue-300'
                      : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              )
            })}
            
            <button
              onClick={() => handlePageChange(state.currentPage + 1)}
              disabled={state.currentPage === state.totalPages}
              className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default GradeManagementPage