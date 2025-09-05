import React from 'react'
import type { DataOverview } from '../dataTypes'
import { Users, TrendingUp, BookOpen, Target } from 'lucide-react'

export const DataOverviewCards: React.FC<{ overview: DataOverview }> = ({ overview }) => {
  return (
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
  )
}
