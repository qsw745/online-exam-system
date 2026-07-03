import React from 'react'
import type { DataOverview } from '@/shared/hooks/useDataAnalytics'
import { Users, TrendingUp, BookOpen, Target } from 'lucide-react'
import { translate } from '@/shared/utils/i18n'

export const DataOverviewCards: React.FC<{ overview: DataOverview }> = ({ overview }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{translate('auto.5e50829d28')}</p>
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
            <p className="text-sm font-medium text-gray-600">{translate('auto.ef0369a594')}</p>
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
            <p className="text-sm font-medium text-gray-600">{translate('auto.852af3e1bd')}</p>
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
            <p className="text-sm font-medium text-gray-600">{translate('dashboard.average_score')}</p>
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
