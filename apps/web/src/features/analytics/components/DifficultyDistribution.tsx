// apps/web/src/features/analytics/components/DifficultyDistribution.tsx
import React from 'react'
import type { DifficultyDatum } from '@/shared/hooks/useDataAnalytics'

function labelOf(d: string) {
  if (d === 'easy') return '简单'
  if (d === 'medium') return '中等'
  if (d === 'hard') return '困难'
  return d
}

/** 统一从不同字段里拿正确率: 返回 0~1 的小数 */
function getCorrectRate(item: DifficultyDatum): number {
  const anyItem = item as any
  let rate: unknown = anyItem.correctRate ?? anyItem.correct_rate ?? anyItem.accuracy ?? anyItem.rate

  if (typeof rate !== 'number') {
    // 尝试用 “正确数 / 总数” 计算
    const correct = typeof anyItem.correct === 'number' ? anyItem.correct : undefined
    const count = typeof anyItem.count === 'number' ? anyItem.count : undefined
    if (typeof correct === 'number' && typeof count === 'number' && count > 0) {
      rate = correct / count
    }
  }

  const r = typeof rate === 'number' && isFinite(rate) ? rate : 0
  // clamp 到 [0, 1]
  return Math.max(0, Math.min(1, r))
}

export const DifficultyDistribution: React.FC<{ list: DifficultyDatum[] }> = ({ list }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">难度分布</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {list.map(item => {
          const rate = getCorrectRate(item)
          return (
            <div key={(item as any).difficulty} className="p-4 bg-gray-50 rounded-lg">
              <div className="text-lg font-medium text-gray-900 mb-2">{labelOf(String((item as any).difficulty))}</div>
              <div className="text-3xl font-bold text-gray-900 mb-2">{(item as any).count ?? 0}</div>
              <div className="text-sm text-gray-500">正确率 {(rate * 100).toFixed(1)}%</div>
            </div>
          )
        })}
        {list.length === 0 && <div className="text-sm text-gray-500">暂无数据</div>}
      </div>
    </div>
  )
}
