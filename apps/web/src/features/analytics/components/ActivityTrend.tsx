import React from 'react'
import type { ActivityDatum } from '@/shared/hooks/useDataAnalytics'
import { translate } from '@/shared/utils/i18n'
// ✅ 兼容多种字段命名
type ActivityItem = ActivityDatum & {
  activeUsers?: number
  active_users?: number
  submissions?: number
  submission_count?: number
}
export const ActivityTrend: React.FC<{ list: ActivityDatum[]; totalUsers: number }> = ({ list, totalUsers }) => {
  const data = list as ActivityItem[]

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{translate('auto.7975252cfa')}</h2>
      <div className="space-y-4">
        {data.map(item => {
          const activeUsers = item.activeUsers ?? item.active_users ?? 0
          const submissions = item.submissions ?? item.submission_count ?? 0
          const ratio = totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0
          return (
            <div key={item.date} className="flex items-center space-x-4">
              <div className="w-24 text-sm text-gray-500">{item.date}</div>
              <div className="flex-1">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-600 rounded-full"
                    style={{ width: `${Math.max(0, Math.min(100, ratio))}%` }}
                  />
                </div>
              </div>
              <div className="w-32 text-sm text-gray-500">{activeUsers} {translate('auto.ef0369a594')}</div>
              <div className="w-32 text-sm text-gray-500">{submissions} {translate('app.submit')}</div>
            </div>
          )
        })}
        {data.length === 0 && <div className="text-sm text-gray-500">{translate('common.no_data')}</div>}
      </div>
    </div>
  )
}
