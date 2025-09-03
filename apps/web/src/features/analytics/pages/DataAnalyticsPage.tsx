import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import { message } from 'antd'
import { api } from '../../lib/api'
import {
  BarChart3,
  TrendingUp,
  Users,
  BookOpen,
  Target,
  Calendar,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react'

interface Overview {
  totalUsers: number
  activeUsers: number
  totalSubmissions: number
  averageScore: number
}

interface KnowledgePoint {
  id: string
  name: string
  correctRate: number
  questionCount: number
}

interface DifficultyData {
  difficulty: string
  count: number
  correctRate: number
}

interface ActivityData {
  date: string
  submissions: number
  activeUsers: number
}

const DataAnalyticsPage: React.FC = () => {
  const { user } = useAuth()
  const [period, setPeriod] = useState('7d')
  const [overview, setOverview] = useState<Overview>({
    totalUsers: 0,
    activeUsers: 0,
    totalSubmissions: 0,
    averageScore: 0
  })
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([])
  const [difficultyData, setDifficultyData] = useState<DifficultyData[]>([])
  const [activityData, setActivityData] = useState<ActivityData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [period])

  const loadData = async () => {
    try {
      setLoading(true)
      await Promise.all([
        loadOverview(),
        loadKnowledgePoints(),
        loadDifficultyData(),
        loadActivityData()
      ])
    } finally {
      setLoading(false)
    }
  }

  const loadOverview = async () => {
    try {
      const { data } = await api.get(`/analytics/overview?period=${period}`)
      setOverview(data || {
        totalUsers: 0,
        activeUsers: 0,
        totalSubmissions: 0,
        averageScore: 0
      })
    } catch (error: any) {
      console.error('加载概览数据错误:', error)
      message.error(error.response?.data?.error || '加载概览数据失败')
      setOverview({
        totalUsers: 0,
        activeUsers: 0,
        totalSubmissions: 0,
        averageScore: 0
      })
    }
  }

  const loadKnowledgePoints = async () => {
    try {
      const { data } = await api.get('/analytics/knowledge-points')
      setKnowledgePoints(data || [])
    } catch (error: any) {
      console.error('加载知识点数据错误:', error)
      message.error(error.response?.data?.error || '加载知识点数据失败')
      setKnowledgePoints([])
    }
  }

  const loadDifficultyData = async () => {
    try {
      const { data } = await api.get('/analytics/difficulty-distribution')
      setDifficultyData(data || [])
    } catch (error: any) {
      console.error('加载难度数据错误:', error)
      message.error(error.response?.data?.error || '加载难度数据失败')
      setDifficultyData([])
    }
  }

  const loadActivityData = async () => {
    try {
      const { data } = await api.get(`/analytics/user-activity?period=${period}`)
      setActivityData(data || [])
    } catch (error: any) {
      console.error('加载活跃度数据错误:', error)
      message.error(error.response?.data?.error || '加载活跃度数据失败')
      setActivityData([])
    }
  }

  if (loading) {
    return <LoadingSpinner text="加载数据分析..." />
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">数据分析</h1>
        <p className="text-gray-600 mt-1">查看系统使用情况和学习效果分析</p>
      </div>

      {/* 时间范围选择 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-gray-500" />
            <span className="text-gray-700">时间范围</span>
          </div>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="7d">最近7天</option>
            <option value="30d">最近30天</option>
            <option value="90d">最近90天</option>
            <option value="all">全部时间</option>
          </select>
        </div>
      </div>

      {/* 概览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">总用户数</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{overview.totalUsers}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">活跃用户</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{overview.activeUsers}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">总提交次数</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{overview.totalSubmissions}</p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg">
              <BookOpen className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">平均分数</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{overview.averageScore.toFixed(1)}</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <Target className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 知识点掌握情况 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">知识点掌握情况</h2>
        <div className="space-y-4">
          {knowledgePoints.map((point) => (
            <div key={point.id} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{point.name}</span>
                <span className="text-gray-500">{point.questionCount} 题</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full"
                  style={{ width: `${point.correctRate * 100}%` }}
                />
              </div>
              <div className="text-sm text-gray-500 text-right">
                正确率 {(point.correctRate * 100).toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 难度分布 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">难度分布</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {difficultyData.map((item) => (
            <div key={item.difficulty} className="p-4 bg-gray-50 rounded-lg">
              <div className="text-lg font-medium text-gray-900 mb-2">
                {item.difficulty === 'easy' && '简单'}
                {item.difficulty === 'medium' && '中等'}
                {item.difficulty === 'hard' && '困难'}
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-2">{item.count}</div>
              <div className="text-sm text-gray-500">正确率 {(item.correctRate * 100).toFixed(1)}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* 活跃度趋势 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">活跃度趋势</h2>
        <div className="space-y-4">
          {activityData.map((item) => (
            <div key={item.date} className="flex items-center space-x-4">
              <div className="w-24 text-sm text-gray-500">{item.date}</div>
              <div className="flex-1">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-600 rounded-full"
                    style={{ width: `${(item.activeUsers / overview.totalUsers) * 100}%` }}
                  />
                </div>
              </div>
              <div className="w-32 text-sm text-gray-500">
                {item.activeUsers} 活跃用户
              </div>
              <div className="w-32 text-sm text-gray-500">
                {item.submissions} 提交
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default DataAnalyticsPage