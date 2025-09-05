import React from 'react'
import type { DifficultyDatum } from '../dataTypes'

function labelOf(d: string) {
  if (d === 'easy') return '简单'
  if (d === 'medium') return '中等'
  if (d === 'hard') return '困难'
  return d
}

export const DifficultyDistribution: React.FC<{ list: DifficultyDatum[] }> = ({ list }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">难度分布</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {list.map(item => (
          <div key={item.difficulty} className="p-4 bg-gray-50 rounded-lg">
            <div className="text-lg font-medium text-gray-900 mb-2">{labelOf(item.difficulty)}</div>
            <div className="text-3xl font-bold text-gray-900 mb-2">{item.count}</div>
            <div className="text-sm text-gray-500">
              正确率 {Math.max(0, Math.min(100, item.correctRate * 100)).toFixed(1)}%
            </div>
          </div>
        ))}
        {list.length === 0 && <div className="text-sm text-gray-500">暂无数据</div>}
      </div>
    </div>
  )
}
