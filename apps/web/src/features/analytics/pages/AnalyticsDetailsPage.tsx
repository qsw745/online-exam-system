import React, { useEffect } from 'react'
import { App } from 'antd'
import LoadingSpinner from '@/shared/components/LoadingSpinner'
import { useDataAnalytics } from '@/shared/hooks/useDataAnalytics'
import { DataPeriodFilter } from '@/features/analytics/components/DataPeriodFilter'
import { DataOverviewCards } from '@/features/analytics/components/DataOverviewCards'
import { KnowledgePointsPanel } from '@/features/analytics/components/KnowledgePointsPanel'
import { DifficultyDistribution } from '@/features/analytics/components/DifficultyDistribution'
import { ActivityTrend } from '@/features/analytics/components/ActivityTrend'
import type { Period } from '@/shared/hooks/useDataAnalytics'
import { BarChart3 } from 'lucide-react'

const DataAnalyticsPage: React.FC = () => {
  const { message } = App.useApp()
  const [period, setPeriod] = React.useState<Period>('7d')

  const { overview, knowledgePoints, difficulty, activity, isLoading, error, refetchAll } = useDataAnalytics(period)

  useEffect(() => {
    if (error) message.error(error.message || '获取数据分析失败')
  }, [error, message])

  // 初次或切换 period 时的加载
  if (isLoading && !overview) {
    return <LoadingSpinner text="加载数据分析..." />
  }

  const ov = overview || { totalUsers: 0, activeUsers: 0, totalSubmissions: 0, averageScore: 0 }

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div className="flex items-center space-x-3">
        <BarChart3 className="w-6 h-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">数据分析</h1>
          <p className="text-gray-600 mt-1">查看系统使用情况和学习效果分析</p>
        </div>
      </div>

      {/* 筛选 */}
      <DataPeriodFilter
        period={period}
        onChange={p => {
          setPeriod(p)
          refetchAll()
        }}
      />

      {/* 概览卡片 */}
      <DataOverviewCards overview={ov} />

      {/* 知识点 */}
      <KnowledgePointsPanel list={knowledgePoints} />

      {/* 难度分布 */}
      <DifficultyDistribution list={difficulty} />

      {/* 活跃度趋势 */}
      <ActivityTrend list={activity} totalUsers={ov.totalUsers} />
    </div>
  )
}

export default DataAnalyticsPage
