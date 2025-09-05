import React from 'react'
import type { ActivityDatum } from '../dataTypes'

export const ActivityTrend: React.FC<{ list: ActivityDatum[]; totalUsers: number }> = ({ list, totalUsers }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">活跃度趋势</h2>
      <div className="space-y-4">
        {list.map(item => {
          const ratio = totalUsers > 0 ? (item.activeUsers / totalUsers) * 100 : 0
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
              <div className="w-32 text-sm text-gray-500">{item.activeUsers} 活跃用户</div>
              <div className="w-32 text-sm text-gray-500">{item.submissions} 提交</div>
            </div>
          )
        })}
        {list.length === 0 && <div className="text-sm text-gray-500">暂无数据</div>}
      </div>
    </div>
  )
}
