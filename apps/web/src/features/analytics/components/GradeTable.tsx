import type { StudentResult } from '@shared/types/grades'
import { Eye, Trophy } from 'lucide-react'
import React from 'react'

type Props = {
  results: StudentResult[]
  statusClass: (s: string) => string
  statusLabel: (s: string) => string
  scoreClass: (p: number) => string
  onView?: (r: StudentResult) => void
  loading?: boolean
}

export const GradeTable: React.FC<Props> = ({ results, statusClass, statusLabel, scoreClass, onView, loading }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                学生信息
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">试卷</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">成绩</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">用时</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                提交时间
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {results.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{r.student_name || '未知学生'}</div>
                    <div className="text-sm text-gray-500">{r.student_email}</div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900 max-w-xs truncate">{r.paper_title}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm">
                    <span className={`font-medium ${scoreClass(r.percentage)}`}>
                      {r.score}/{r.total_score}
                    </span>
                    <div className="text-xs text-gray-500">{r.percentage.toFixed(1)}%</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {r.duration ? `${Math.floor(r.duration / 60)}分${r.duration % 60}秒` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusClass(r.status)}`}>
                    {statusLabel(r.status)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(r.created_at).toLocaleString('zh-CN')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => onView?.(r)}
                    className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                  >
                    <Eye className="h-4 w-4" />
                    查看详情
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {results.length === 0 && !loading && (
        <div className="text-center py-12">
          <Trophy className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">暂无成绩数据</h3>
          <p className="mt-1 text-sm text-gray-500">还没有学生提交考试成绩</p>
        </div>
      )}
    </div>
  )
}
