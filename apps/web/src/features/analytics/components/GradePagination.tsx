import React from 'react'

type Props = {
  page: number
  pageSize: number
  totalPages: number
  totalResults: number
  onChange: (p: number) => void
}

export const GradePagination: React.FC<Props> = ({ page, pageSize, totalPages, totalResults, onChange }) => {
  if (totalPages <= 1) return null

  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalResults)
  const base = Math.max(1, page - 2)
  const pages = Array.from({ length: Math.min(5, totalPages - base + 1) }, (_, i) => base + i)

  return (
    <div className="mt-6 flex items-center justify-between">
      <div className="text-sm text-gray-700">
        显示第 {start} - {end} 条，共 {totalResults} 条记录
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-80 disabled:cursor-not-allowed"
        >
          上一页
        </button>

        {pages.map(p => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`px-3 py-2 text-sm font-medium rounded-md ${
              p === page
                ? 'text-blue-600 bg-blue-50 border border-blue-300'
                : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {p}
          </button>
        ))}

        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-80 disabled:cursor-not-allowed"
        >
          下一页
        </button>
      </div>
    </div>
  )
}
