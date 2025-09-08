import type { PaperLite } from '@shared/types/grades'
import { Download, Search } from 'lucide-react'
import React, { FormEvent } from 'react'

type Props = {
  searchTerm: string
  onSearchChange: (v: string) => void
  onSearchSubmit: () => void
  papers: PaperLite[]
  filterPaper: string
  filterStatus: string
  onFilterPaper: (v: string) => void
  onFilterStatus: (v: string) => void
  onExport: () => void
  exporting?: boolean
}

export const GradeFilters: React.FC<Props> = ({
  searchTerm,
  onSearchChange,
  onSearchSubmit,
  papers,
  filterPaper,
  filterStatus,
  onFilterPaper,
  onFilterStatus,
  onExport,
  exporting,
}) => {
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSearchSubmit()
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
      <div className="flex flex-col lg:flex-row gap-4">
        <form onSubmit={submit} className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="搜索学生姓名或邮箱..."
              value={searchTerm}
              onChange={e => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </form>

        <div className="flex gap-4">
          <select
            value={filterPaper}
            onChange={e => onFilterPaper(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">所有试卷</option>
            {papers.map(p => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={e => onFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">所有状态</option>
            <option value="completed">已完成</option>
            <option value="in_progress">进行中</option>
            <option value="not_started">未开始</option>
          </select>

          <button
            onClick={onExport}
            disabled={!!exporting}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-70"
          >
            <Download className="h-4 w-4" />
            导出
          </button>
        </div>
      </div>
    </div>
  )
}
