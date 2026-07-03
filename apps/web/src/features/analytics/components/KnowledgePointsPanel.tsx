import React from 'react'
import type { KnowledgePoint } from '@/shared/hooks/useDataAnalytics'
import { translate } from '@/shared/utils/i18n'

export const KnowledgePointsPanel: React.FC<{ list: KnowledgePoint[] }> = ({ list }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{translate('auto.20d0d6068d')}</h2>
      <div className="space-y-4">
        {list.map(point => (
          <div key={point.id} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700">{point.name}</span>
              <span className="text-gray-500">{point.questionCount} {translate('papers.unit_question')}</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full"
                style={{ width: `${Math.max(0, Math.min(100, point.correctRate * 100))}%` }}
              />
            </div>
            <div className="text-sm text-gray-500 text-right">
              {translate('auto.8dc159502e')}{Math.max(0, Math.min(100, point.correctRate * 100)).toFixed(1)}%
            </div>
          </div>
        ))}
        {list.length === 0 && <div className="text-sm text-gray-500">{translate('common.no_data')}</div>}
      </div>
    </div>
  )
}
