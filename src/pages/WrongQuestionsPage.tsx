import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  BookOpen, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  BarChart3,
  Filter,
  RefreshCw,
  Trash2,
  Eye
} from 'lucide-react'
import { wrongQuestions } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'
import toast from 'react-hot-toast'

interface WrongQuestion {
  id: number
  user_id: number
  question_id: number
  first_wrong_time: string
  last_practice_time: string
  wrong_count: number
  correct_count: number
  is_mastered: boolean
  notes?: string
  content: string
  question_type: string
  options?: any
  correct_answer?: any
  explanation?: string
  knowledge_points?: string[]
}

interface PracticeStats {
  totalPractice: number
  correctRate: string
  wrongQuestions: number
  masteredQuestions: number
}

export default function WrongQuestionsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  
  const [loading, setLoading] = useState(true)
  const [wrongQuestionsList, setWrongQuestionsList] = useState<WrongQuestion[]>([])
  const [stats, setStats] = useState<PracticeStats | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filter, setFilter] = useState<'all' | 'unmastered' | 'mastered'>('unmastered')
  const [refreshing, setRefreshing] = useState(false)

  // 加载错题本数据
  const loadWrongQuestions = async (page = 1) => {
    try {
      setLoading(true)
      const mastered = filter === 'all' ? undefined : filter === 'mastered'
      const response = await wrongQuestions.getWrongQuestions({
        page,
        limit: 10,
        mastered
      })
      
      if (response.success) {
        setWrongQuestionsList(response.data.wrongQuestions)
        setCurrentPage(response.data.pagination.currentPage)
        setTotalPages(response.data.pagination.totalPages)
      }
    } catch (error) {
      console.error('加载错题本失败:', error)
      toast.error('加载错题本失败')
    } finally {
      setLoading(false)
    }
  }

  // 加载练习统计
  const loadStats = async () => {
    try {
      const response = await wrongQuestions.getPracticeStats()
      if (response.success) {
        setStats(response.data)
      }
    } catch (error) {
      console.error('加载统计数据失败:', error)
    }
  }

  // 标记为已掌握
  const handleMarkAsMastered = async (questionId: number) => {
    try {
      await wrongQuestions.markAsMastered(questionId)
      toast.success('已标记为掌握')
      loadWrongQuestions(currentPage)
      loadStats()
    } catch (error) {
      console.error('标记掌握失败:', error)
      toast.error('操作失败')
    }
  }

  // 从错题本移除
  const handleRemoveFromWrongQuestions = async (questionId: number) => {
    try {
      await wrongQuestions.removeFromWrongQuestions(questionId)
      toast.success('已从错题本移除')
      loadWrongQuestions(currentPage)
      loadStats()
    } catch (error) {
      console.error('移除失败:', error)
      toast.error('操作失败')
    }
  }

  // 刷新数据
  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([loadWrongQuestions(currentPage), loadStats()])
    setRefreshing(false)
    toast.success('数据已刷新')
  }

  // 查看题目详情
  const handleViewQuestion = (questionId: number) => {
    navigate(`/questions/${questionId}`)
  }

  // 获取题目类型标签
  const getQuestionTypeLabel = (type: string) => {
    const typeMap = {
      'single_choice': '单选题',
      'multiple_choice': '多选题',
      'true_false': '判断题',
      'short_answer': '简答题'
    }
    return typeMap[type as keyof typeof typeMap] || type
  }

  useEffect(() => {
    loadWrongQuestions(1)
    loadStats()
  }, [filter])

  if (loading && wrongQuestionsList.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner text="加载错题本中..." />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">错题本</h1>
          <p className="text-gray-600 mt-2">复习错题，巩固知识点</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>刷新</span>
        </button>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">总练习次数</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalPractice}</p>
              </div>
              <BookOpen className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">正确率</p>
                <p className="text-2xl font-bold text-green-600">{stats.correctRate}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">错题数量</p>
                <p className="text-2xl font-bold text-red-600">{stats.wrongQuestions}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">已掌握</p>
                <p className="text-2xl font-bold text-blue-600">{stats.masteredQuestions}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-blue-500" />
            </div>
          </div>
        </div>
      )}

      {/* 筛选器 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center space-x-4">
          <Filter className="w-5 h-5 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">筛选:</span>
          <div className="flex space-x-2">
            <button
              onClick={() => setFilter('unmastered')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'unmastered'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              未掌握
            </button>
            <button
              onClick={() => setFilter('mastered')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'mastered'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              已掌握
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              全部
            </button>
          </div>
        </div>
      </div>

      {/* 错题列表 */}
      {wrongQuestionsList.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">暂无错题</h3>
          <p className="text-gray-600 mb-6">
            {filter === 'unmastered' ? '恭喜！您暂时没有未掌握的错题' : 
             filter === 'mastered' ? '您还没有掌握任何错题' : 
             '您的错题本是空的，开始练习题目吧！'}
          </p>
          <button
            onClick={() => navigate('/questions/all')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            开始练习
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {wrongQuestionsList.map((item) => (
            <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                      {getQuestionTypeLabel(item.question_type)}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      item.is_mastered 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {item.is_mastered ? '已掌握' : '未掌握'}
                    </span>
                  </div>
                  
                  <div className="text-gray-900 mb-3 line-clamp-2">
                    {item.content}
                  </div>
                  
                  <div className="flex items-center space-x-6 text-sm text-gray-600">
                    <span>错误次数: {item.wrong_count}</span>
                    <span>正确次数: {item.correct_count}</span>
                    <span>最后练习: {new Date(item.last_practice_time).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => handleViewQuestion(item.question_id)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="查看题目"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                  
                  {!item.is_mastered && (
                    <button
                      onClick={() => handleMarkAsMastered(item.question_id)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="标记为已掌握"
                    >
                      <CheckCircle className="w-5 h-5" />
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleRemoveFromWrongQuestions(item.question_id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="从错题本移除"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2 mt-8">
          <button
            onClick={() => loadWrongQuestions(currentPage - 1)}
            disabled={currentPage === 1 || loading}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            上一页
          </button>
          
          <span className="px-4 py-2 text-gray-700">
            第 {currentPage} 页，共 {totalPages} 页
          </span>
          
          <button
            onClick={() => loadWrongQuestions(currentPage + 1)}
            disabled={currentPage === totalPages || loading}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  )
}