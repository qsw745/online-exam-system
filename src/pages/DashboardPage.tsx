import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { Calendar, Clock, Trophy, FileText, TrendingUp, BookmarkPlus } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { api } from '../lib/api'

interface Task {
  id: string
  title: string
  type: string
  status: string
  start_time: string
  end_time: string
}

interface Result {
  id: string
  paper_title: string
  score: number
  total_score: number
  created_at: string
}

interface Stats {
  total_tasks: number
  completed_tasks: number
  average_score: number
  best_score: number
}

const DashboardPage: React.FC = () => {
  const { user } = useAuth()
  const { t, language } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats>({
    total_tasks: 0,
    completed_tasks: 0,
    average_score: 0,
    best_score: 0
  })
  const [recentTasks, setRecentTasks] = useState<Task[]>([])
  const [recentResults, setRecentResults] = useState<Result[]>([])

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      const defaultStats = {
        total_tasks: 0,
        completed_tasks: 0,
        average_score: 0,
        best_score: 0
      }

      const [statsResponse, tasksResponse, resultsResponse] = await Promise.all([
        api.get('/dashboard/stats').catch(() => ({ success: false, error: t('dashboard.stats_api_undefined') })),
        api.get('/tasks', { params: { limit: 5, sort: 'start_time' } }).catch(() => ({ success: false, error: t('dashboard.tasks_api_undefined') })),
        api.get('/exam_results', { params: { limit: 5, sort: 'created_at' } }).catch(() => ({ success: false, error: t('dashboard.results_api_undefined') }))
      ])

      if (statsResponse?.success) {
        setStats(statsResponse?.data ?? defaultStats)
      } else {
        console.error(t('dashboard.stats_load_error'), statsResponse?.error)
        toast.error(t('dashboard.stats_load_error'))
        setStats(defaultStats)
      }

      if (tasksResponse?.success) {
        setRecentTasks(tasksResponse?.data?.tasks ?? [])
      } else {
        console.error(t('dashboard.tasks_load_error'), tasksResponse?.error)
        toast.error(t('dashboard.tasks_load_error'))
        setRecentTasks([])
      }

      if (resultsResponse?.success) {
        setRecentResults(resultsResponse?.data?.results ?? [])
      } else {
        console.error(t('dashboard.results_load_error'), resultsResponse?.error)
        toast.error(t('dashboard.results_load_error'))
        setRecentResults([])
      }
    } catch (error: any) {
      console.error(t('dashboard.load_error'), error)
      toast.error(error.message || t('dashboard.load_error'))
      setStats({
        total_tasks: 0,
        completed_tasks: 0,
        average_score: 0,
        best_score: 0
      })
      setRecentTasks([])
      setRecentResults([])
    } finally {
      setLoading(false)
    }
  }

  const getStatusLabel = (status: string) => {
    const statusMap = {
      'not_started': t('dashboard.status_not_started'),
      'in_progress': t('dashboard.status_in_progress'),
      'completed': t('dashboard.status_completed'),
      'expired': t('dashboard.status_expired')
    }
    return statusMap[status as keyof typeof statusMap] || status
  }

  const getStatusColor = (status: string) => {
    const colorMap = {
      'not_started': 'bg-gray-100 text-gray-800',
      'in_progress': 'bg-yellow-100 text-yellow-800',
      'completed': 'bg-green-100 text-green-800',
      'expired': 'bg-red-100 text-red-800'
    }
    return colorMap[status as keyof typeof colorMap] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return <LoadingSpinner text={t('dashboard.loading')} />
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('dashboard.title')}</h1>
        <p className="text-gray-600 mt-1">{t('dashboard.description')}</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('dashboard.total_tasks')}</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total_tasks}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('dashboard.completed_tasks')}</p>
              <p className="text-2xl font-bold text-gray-900">{stats.completed_tasks}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('dashboard.average_score')}</p>
              <p className="text-2xl font-bold text-gray-900">{stats.average_score.toFixed(1)}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('dashboard.best_score')}</p>
              <p className="text-2xl font-bold text-gray-900">{stats.best_score}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <Trophy className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 最近任务和成绩 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 最近任务 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">{t('dashboard.recent_tasks')}</h2>
            <Link
              to="/tasks"
              className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
            >
              {t('dashboard.view_all')}
            </Link>
          </div>

          <div className="space-y-4">
            {recentTasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <h3 className="font-medium text-gray-900">{task.title}</h3>
                  <div className="flex items-center space-x-2 mt-1 text-sm text-gray-500">
                    <Calendar className="w-4 h-4" />
                    <span>{t('dashboard.start_time')}: {new Date(task.start_time).toLocaleString(language === 'zh-CN' ? 'zh-CN' : 'en-US')}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      task.type === 'exam' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {task.type === 'exam' ? t('dashboard.exam') : t('dashboard.practice')}
                  </span>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}
                  >
                    {getStatusLabel(task.status)}
                  </span>
                </div>
              </div>
            ))}

            {recentTasks.length === 0 && (
              <div className="text-center py-8">
                <BookmarkPlus className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">{t('dashboard.no_tasks')}</p>
              </div>
            )}
          </div>
        </div>

        {/* 最近成绩 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">{t('dashboard.recent_results')}</h2>
            <Link
              to="/results"
              className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
            >
              {t('dashboard.view_all')}
            </Link>
          </div>

          <div className="space-y-4">
            {recentResults.map((result) => (
              <div key={result.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <h3 className="font-medium text-gray-900">{result.paper_title}</h3>
                  <div className="flex items-center space-x-2 mt-1 text-sm text-gray-500">
                    <Calendar className="w-4 h-4" />
                    <span>{t('dashboard.submit_time')}: {new Date(result.created_at).toLocaleString(language === 'zh-CN' ? 'zh-CN' : 'en-US')}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-gray-900">
                    {result.score} / {result.total_score}
                  </div>
                  <div className="text-sm text-gray-500">
                    {t('dashboard.score')}
                  </div>
                </div>
              </div>
            ))}

            {recentResults.length === 0 && (
              <div className="text-center py-8">
                <BookmarkPlus className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">{t('dashboard.no_results')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
