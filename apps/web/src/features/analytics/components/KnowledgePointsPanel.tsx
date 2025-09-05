import React from 'react'
import type { KnowledgePoint } from '../dataTypes'

export const KnowledgePointsPanel: React.FC<{ list: KnowledgePoint[] }> = ({ list }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">知识点掌握情况</h2>
      <div className="space-y-4">
        {list.map(point => (
          <div key={point.id} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700">{point.name}</span>
              <span className="text-gray-500">{point.questionCount} 题</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full"
                style={{ width: `${Math.max(0, Math.min(100, point.correctRate * 100))}%` }}
              />
            </div>
            <div className="text-sm text-gray-500 text-right">
              正确率 {Math.max(0, Math.min(100, point.correctRate * 100)).toFixed(1)}%
            </div>
          </div>
        ))}
        {list.length === 0 && <div className="text-sm text-gray-500">暂无数据</div>}
      </div>
    </div>
  )
}
