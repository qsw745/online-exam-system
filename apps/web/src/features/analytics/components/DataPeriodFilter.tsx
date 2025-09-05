import React from 'react'
import type { Period } from '../dataTypes'
import { Filter } from 'lucide-react'

type Props = {
  period: Period
  onChange: (p: Period) => void
}

export const DataPeriodFilter: React.FC<Props> = ({ period, onChange }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Filter className="w-5 h-5 text-gray-500" />
          <span className="text-gray-700">时间范围</span>
        </div>
        <select
          value={period}
          onChange={e => onChange(e.target.value as Period)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="7d">最近7天</option>
          <option value="30d">最近30天</option>
          <option value="90d">最近90天</option>
          <option value="all">全部时间</option>
        </select>
      </div>
    </div>
  )
}
