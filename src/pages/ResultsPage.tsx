import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { Search, Filter, Eye, Clock, BookmarkPlus } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { api } from '../lib/api'

interface Result {
  id: string
  paper_id: string
  paper_title: string
  score: number
  total_score: number
  start_time: string
  end_time: string
  status: string
  created_at: string
  updated_at: string
}

interface State {
  results: Result[]
  loading: boolean
  searchTerm: string
  filterStatus: string
  // 分页状态
  currentPage: number
  totalPages: number
  totalResults: number
  pageSize: number
}

const ResultsPage: React.FC = () => {
  const { user } = useAuth()
  const { t, language } = useLanguage()
  const [state, setState] = useState<State>({
    results: [],
    loading: true,
    searchTerm: '',
    filterStatus: 'all',
    // 分页状态
    currentPage: 1,
    totalPages: 1,
    totalResults: 0,
    pageSize: 12
  })

  useEffect(() => {
    loadResults()
  }, [state.currentPage, state.searchTerm, state.filterStatus])

  const loadResults = async () => {
    try {
      setState(prev => ({ ...prev, loading: true }))
      const { data } = await api.get('/exam_results', {
        params: {
          page: state.currentPage,
          limit: state.pageSize,
          status: state.filterStatus === 'all' ? undefined : state.filterStatus,
          search: state.searchTerm || undefined
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
      console.error('加载考试结果错误:', error)
      toast.error(error.response?.data?.message || '加载考试结果失败')
      setState(prev => ({ ...prev, loading: false }))
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    loadResults()
  }

  const handleFilterChange = (value: string) => {
    setState(prev => ({ ...prev, filterStatus: value, currentPage: 1 }))
  }

  // 分页控制函数
  const handlePageChange = (page: number) => {
    setState(prev => ({ ...prev, currentPage: page }))
  }

  const handlePrevPage = () => {
    if (state.currentPage > 1) {
      setState(prev => ({ ...prev, currentPage: prev.currentPage - 1 }))
    }
  }

  const handleNextPage = () => {
    if (state.currentPage < state.totalPages) {
      setState(prev => ({ ...prev, currentPage: prev.currentPage + 1 }))
    }
  }

  // 搜索处理
  const handleSearchChange = (value: string) => {
    setState(prev => ({ ...prev, searchTerm: value, currentPage: 1 }))
  }

  const getStatusLabel = (status: string) => {
    const statusMap = {
      'completed': t('results.status_completed'),
      'in_progress': t('results.status_in_progress'),
      'not_started': t('results.status_not_started')
    }
    return statusMap[status as keyof typeof statusMap] || status
  }

  const getStatusColor = (status: string) => {
    const colorMap = {
      'completed': 'bg-green-100 text-green-800',
      'in_progress': 'bg-yellow-100 text-yellow-800',
      'not_started': 'bg-gray-100 text-gray-800'
    }
    return colorMap[status as keyof typeof colorMap] || 'bg-gray-100 text-gray-800'
  }

  if (state.loading) {
    return <LoadingSpinner text={t('results.loading')} />
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('results.title')}</h1>
        <p className="text-gray-600 mt-1">{t('results.description')}</p>
      </div>

      {/* 搜索和筛选 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-4 md:space-y-0">
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={state.searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={t('results.search_placeholder')}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </form>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <select
                value={state.filterStatus}
                onChange={(e) => handleFilterChange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">{t('results.all_status')}</option>
                <option value="completed">{t('results.status_completed')}</option>
                <option value="in_progress">{t('results.status_in_progress')}</option>
                <option value="not_started">{t('results.status_not_started')}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 结果列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {state.results.map((result) => (
          <div key={result.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                  <Link to={`/results/${result.id}`} className="hover:text-blue-600 transition-colors">
                    {result.paper_title}
                  </Link>
                </h3>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <BookmarkPlus className="w-4 h-4" />
                    <span>{t('results.score_display')}: {result.score} / {result.total_score}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <Clock className="w-4 h-4" />
                    <span>{t('results.start_time')}: {new Date(result.start_time).toLocaleString(language === 'zh-CN' ? 'zh-CN' : 'en-US')}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(result.status)}`}
              >
                {getStatusLabel(result.status)}
              </span>
              <Link
                to={`/results/${result.id}`}
                className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Eye className="w-4 h-4" />
                <span>{t('results.view_details')}</span>
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* 空状态 */}
      {state.results.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <BookmarkPlus className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">{t('results.no_records')}</h3>
          <p className="text-gray-500 mt-1">{t('results.no_records_desc')}</p>
        </div>
      )}

      {/* 分页组件 */}
      {state.totalPages > 1 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              显示第 {((state.currentPage - 1) * state.pageSize) + 1} - {Math.min(state.currentPage * state.pageSize, state.totalResults)} 条，共 {state.totalResults} 条记录
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handlePrevPage}
                disabled={state.currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              
              {/* 页码按钮 */}
              <div className="flex space-x-1">
                {Array.from({ length: Math.min(5, state.totalPages) }, (_, i) => {
                  let pageNum;
                  if (state.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (state.currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (state.currentPage >= state.totalPages - 2) {
                    pageNum = state.totalPages - 4 + i;
                  } else {
                    pageNum = state.currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`px-3 py-1 text-sm border rounded-md ${
                        state.currentPage === pageNum
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={handleNextPage}
                disabled={state.currentPage === state.totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ResultsPage
