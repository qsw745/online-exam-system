import React from 'react'
import type { GradeStats } from '@features/analytics/types/grades'
import { Calendar, TrendingUp, Trophy, Users } from 'lucide-react'

export const GradeStatsCards: React.FC<{ stats: GradeStats }> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center">
          <div className="p-3 rounded-full bg-blue-50 mr-4">
            <Users className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">参与学生</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalStudents}</p>
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
            <p className="text-2xl font-bold text-gray-900">{stats.totalExams}</p>
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
            <p className="text-2xl font-bold text-gray-900">{stats.averageScore.toFixed(1)}</p>
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
            <p className="text-2xl font-bold text-gray-900">{stats.passRate.toFixed(1)}%</p>
          </div>
        </div>
      </div>
    </div>
  )
}
