// features/papers/components/PapersTable.tsx
import { Edit, Eye, FileText, Trash2 } from 'lucide-react'
import type { Paper } from '../endpoints/papers'

const label = (d: string) => (({ easy: '简单', medium: '中等', hard: '困难' } as const)[d as any] ?? d)
const color = (d: string) =>
  ((
    {
      easy: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      hard: 'bg-red-100 text-red-800',
    } as const
  )[d as any] ?? 'bg-gray-100 text-gray-800')

export default function PapersTable({
  items,
  onView,
  onEdit,
  onDelete,
}: {
  items: Paper[]
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">试卷</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">难度</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">总分</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                创建时间
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900 font-medium">{p.title}</div>
                  <div className="text-sm text-gray-500">{p.description}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${color(p.difficulty)}`}>
                    {label(p.difficulty)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.total_score} 分</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(p.created_at).toLocaleString('zh-CN')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  <button className="text-blue-600 hover:text-blue-900" onClick={() => onView(p.id)}>
                    <Eye className="w-5 h-5" />
                  </button>
                  <button className="text-green-600 hover:text-green-900" onClick={() => onEdit(p.id)}>
                    <Edit className="w-5 h-5" />
                  </button>
                  <button className="text-red-600 hover:text-red-900" onClick={() => onDelete(p.id)}>
                    <Trash2 className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}

            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  暂无试卷
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
