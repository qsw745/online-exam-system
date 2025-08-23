import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { Search, Filter, Heart, Eye, Clock, BookmarkPlus, Play } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import Pagination from '../components/ui/Pagination'

import { Link, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import * as apiModule from '../lib/api'
const { questions, favorites: favoritesApi } = apiModule

interface Question {
  id: string
  content: string
  type: string
  difficulty: string
  knowledge_point: string
  created_at: string
  updated_at: string
}

interface State {
  questions: Question[]
  loading: boolean
  searchTerm: string
  filterType: string
  filterDifficulty: string
}

interface PaginationState {
  currentPage: number
  totalPages: number
  totalQuestions: number
  pageSize: number
}

const QuestionsPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth()
  const { t, language } = useLanguage()
  const location = useLocation()
  const [state, setState] = useState<State>({
    questions: [],
    loading: true,
    searchTerm: '',
    filterType: 'all',
    filterDifficulty: 'all'
  })
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    totalPages: 1,
    totalQuestions: 0,
    pageSize: 12
  })
  const [favorites, setFavorites] = useState<Set<string>>(new Set())

  // 根据路由确定当前视图类型
  const getViewType = () => {
    const path = location.pathname
    if (path.includes('/favorites')) return 'favorites'
    if (path.includes('/wrong')) return 'wrong'
    return 'all'
  }

  const viewType = getViewType()

  useEffect(() => {
    // 调试信息
    console.log('QuestionsPage useEffect - 认证状态:', {
      authLoading,
      user: user ? { id: user.id, email: user.email, role: user.role } : null,
      localStorage_token: localStorage.getItem('token') ? 'exists' : 'missing',
      sessionStorage_token: sessionStorage.getItem('token') ? 'exists' : 'missing'
    });
    
    // 只有在认证状态确定且用户已登录时才加载数据
    if (!authLoading && user) {
      loadQuestions()
      loadFavorites()
    } else if (!authLoading && !user) {
      // 认证状态确定但用户未登录，清除加载状态
      setState(prev => ({ ...prev, loading: false }))
    }
  }, [viewType, pagination.currentPage, state.filterType, state.filterDifficulty, state.searchTerm, user, authLoading])

  const loadQuestions = async () => {
    // 检查认证状态是否还在加载中
    if (authLoading) {
      return
    }
    
    // 检查用户是否已登录
    if (!user) {
      setState(prev => ({ ...prev, loading: false }))
      // 不显示错误提示，因为页面会显示登录提示
      return
    }
    
    try {
      setState(prev => ({ ...prev, loading: true }))
      let response
      
      if (viewType === 'favorites') {
        // 加载收藏的题目
        response = await favoritesApi.list()
        const favoriteQuestions = response.data.favorites?.map(f => f.question).filter(q => q && q.id) || []
        setState(prev => ({
          ...prev,
          questions: favoriteQuestions,
          loading: false
        }))
        // 收藏题目暂时不支持分页
        setPagination(prev => ({
          ...prev,
          totalQuestions: favoriteQuestions.length,
          totalPages: 1
        }))
      } else if (viewType === 'wrong') {
        // 加载错题（暂时显示空列表，后续可以添加错题API）
        setState(prev => ({
          ...prev,
          questions: [],
          loading: false
        }))
        setPagination(prev => ({
          ...prev,
          totalQuestions: 0,
          totalPages: 1
        }))
        toast('错题本功能正在开发中', { icon: 'ℹ️' })
      } else {
        // 加载全部题目
        response = await questions.list({
          type: state.filterType === 'all' ? undefined : state.filterType,
          difficulty: state.filterDifficulty === 'all' ? undefined : state.filterDifficulty,
          search: state.searchTerm || undefined,
          page: pagination.currentPage,
          limit: pagination.pageSize
        })
        
        setState(prev => ({
          ...prev,
          questions: response.data.questions || [],
          loading: false
        }))
        
        // 更新分页信息
        if (response.data.pagination) {
          setPagination(prev => ({
            ...prev,
            totalPages: response.data.pagination.totalPages,
            totalQuestions: response.data.pagination.total
          }))
        }
      }
    } catch (error: any) {
      console.error('加载题目错误:', error)
      
      // 检查是否是认证错误
      if (error.message === 'AUTHENTICATION_REQUIRED' || error.response?.status === 401) {
        toast.error('登录已过期，请重新登录')
        // 清除本地认证状态
        localStorage.removeItem('token')
        sessionStorage.removeItem('token')
        localStorage.removeItem('userRole')
        sessionStorage.removeItem('userRole')
        // 刷新页面以触发AuthContext重新检查认证状态
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      } else {
        const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || '获取题目列表失败'
        toast.error(errorMessage)
      }
      
      setState(prev => ({ ...prev, loading: false }))
    }
  }

  const loadFavorites = async () => {
    if (!user) return
    
    try {
      const response = await favoritesApi.list()
      const favoriteIds = new Set(response.data.favorites?.map(f => f.question_id) || [])
      setFavorites(favoriteIds)
    } catch (error: any) {
      console.error('加载收藏错误:', error)
      // 如果收藏表不存在，使用空集合
      setFavorites(new Set())
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPagination(prev => ({ ...prev, currentPage: 1 }))
  }

  const handleFilterChange = (type: string, value: string) => {
    setState(prev => ({
      ...prev,
      [type === 'type' ? 'filterType' : 'filterDifficulty']: value
    }))
    setPagination(prev => ({ ...prev, currentPage: 1 }))
  }

  // 分页处理函数
  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, currentPage: page }))
  }

  const handlePageSizeChange = (pageSize: number) => {
    setPagination(prev => ({ ...prev, pageSize, currentPage: 1 }))
  }

  const handleFavorite = async (questionId: string) => {
    if (!user) {
      toast.error(t('app.login_required'))
      return
    }

    try {
      if (favorites.has(questionId)) {
        await favoritesApi.remove(questionId)
        favorites.delete(questionId)
      } else {
        await favoritesApi.add(questionId)
        favorites.add(questionId)
      }
      setFavorites(new Set(favorites))
    } catch (error: any) {
      console.error('收藏操作错误:', error)
      toast.error(error.response?.data?.message || t('app.operation_failed'))
    }
  }

  // 如果认证状态还在加载中，显示加载状态
  if (authLoading) {
    return <LoadingSpinner text="正在验证登录状态..." />
  }

  // 如果用户未登录，显示登录提示
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">请先登录</h2>
          <p className="text-gray-600 mb-4">您需要登录后才能查看题目列表</p>
          <Link 
            to="/auth/login" 
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            前往登录
          </Link>
        </div>
      </div>
    )
  }

  // 如果题目数据还在加载中，显示加载状态
  if (state.loading) {
    return <LoadingSpinner text={t('app.loading_questions')} />
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {viewType === 'favorites' ? '收藏题目' : 
               viewType === 'wrong' ? '错题本' : 
               t('questions.title')}
            </h1>
            <p className="text-gray-600 mt-1">
              {viewType === 'favorites' ? '查看您收藏的题目' : 
               viewType === 'wrong' ? '查看您做错的题目' : 
               t('questions.description')}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {/* 连续练习按钮 */}
            {viewType === 'all' && state.questions.length > 0 && state.questions[0]?.id && (
              <Link
                to={`/questions/${state.questions[0].id}/practice?mode=continuous&${new URLSearchParams({
                  ...(state.filterType !== 'all' && { type: state.filterType }),
                  ...(state.filterDifficulty !== 'all' && { difficulty: state.filterDifficulty }),
                  ...(state.searchTerm && { search: state.searchTerm })
                }).toString()}`}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Play className="w-5 h-5" />
                <span>开始连续练习</span>
              </Link>
            )}
            

          </div>
        </div>
      </div>

      {/* 搜索和筛选 - 只在全部题目视图中显示 */}
      {viewType === 'all' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-4 md:space-y-0">
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={state.searchTerm}
                  onChange={(e) => setState(prev => ({ ...prev, searchTerm: e.target.value }))}
                  placeholder={t('questions.search_placeholder')}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </form>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Filter className="w-5 h-5 text-gray-500" />
                <select
                  value={state.filterType}
                  onChange={(e) => handleFilterChange('type', e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">{t('questions.all_types')}</option>
                  <option value="single_choice">{t('questions.single_choice')}</option>
                  <option value="multiple_choice">{t('questions.multiple_choice')}</option>
                  <option value="true_false">{t('questions.judge')}</option>
                  <option value="short_answer">{t('questions.fill_blank')}</option>
                </select>
              </div>

              <select
                value={state.filterDifficulty}
                onChange={(e) => handleFilterChange('difficulty', e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">{t('questions.all_difficulties')}</option>
                <option value="easy">{t('questions.easy')}</option>
                <option value="medium">{t('questions.medium')}</option>
                <option value="hard">{t('questions.hard')}</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 题目列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {state.questions.filter(question => question && question.id).map((question) => (
          <div key={question.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                  <Link to={`/questions/${question.id}`} className="hover:text-blue-600 transition-colors">
                    {question.content}
                  </Link>
                </h3>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <BookmarkPlus className="w-4 h-4" />
                    <span>{question.knowledge_point}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <Clock className="w-4 h-4" />
                    <span>{new Date(question.created_at).toLocaleString(language === 'zh-CN' ? 'zh-CN' : 'en-US')}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleFavorite(question.id)}
                className={`p-2 rounded-full transition-colors ${
                  favorites.has(question.id)
                    ? 'text-red-600 hover:text-red-700'
                    : 'text-gray-400 hover:text-gray-500'
                }`}
              >
                <Heart className="w-5 h-5" fill={favorites.has(question.id) ? 'currentColor' : 'none'} />
              </button>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    {
                      single: 'bg-blue-100 text-blue-800',
                      multiple: 'bg-purple-100 text-purple-800',
                      judge: 'bg-green-100 text-green-800',
                      fill: 'bg-yellow-100 text-yellow-800',
                      essay: 'bg-orange-100 text-orange-800'
                    }[question.type] || 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {{
                    single: '单选题',
                    multiple: '多选题',
                    judge: '判断题',
                    fill: '填空题',
                    essay: '问答题'
                  }[question.type] || question.type}
                </span>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    {
                      easy: 'bg-green-100 text-green-800',
                      medium: 'bg-yellow-100 text-yellow-800',
                      hard: 'bg-red-100 text-red-800'
                    }[question.difficulty] || 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {{
                    easy: '简单',
                    medium: '中等',
                    hard: '困难'
                  }[question.difficulty] || question.difficulty}
                </span>
              </div>
              <Link
                to={`/questions/${question.id}`}
                className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Eye className="w-4 h-4" />
                <span>查看</span>
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* 空状态 */}
      {state.questions.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <BookmarkPlus className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">暂无题目</h3>
          <p className="text-gray-500 mt-1">当前筛选条件下没有找到任何题目</p>
        </div>
      )}

      {/* 分页组件 - 只在全部题目视图且有题目时显示 */}
      {viewType === 'all' && state.questions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <Pagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalQuestions}
            pageSize={pagination.pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            showSizeChanger={true}
            showQuickJumper={true}
            showTotal={true}
            pageSizeOptions={[12, 24, 48, 96]}
            size="default"
          />
        </div>
      )}
      

    </div>
  )
}

export default QuestionsPage
