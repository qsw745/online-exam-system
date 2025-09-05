// features/papers/components/PapersToolbar.tsx
import { BookOpen, Plus, Search as SearchIcon } from 'lucide-react'

export default function PapersToolbar({
  search,
  onSearchChange,
  difficulty,
  onDifficultyChange,
  onCreateManual,
  onCreateSmart,
}: {
  search: string
  onSearchChange: (v: string) => void
  difficulty: 'all' | 'easy' | 'medium' | 'hard'
  onDifficultyChange: (v: 'all' | 'easy' | 'medium' | 'hard') => void
  onCreateManual: () => void
  onCreateSmart: () => void
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-200">
      <div className="flex flex-1 gap-4">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="搜索试卷..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={difficulty}
          onChange={e => onDifficultyChange(e.target.value as any)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">所有难度</option>
          <option value="easy">简单</option>
          <option value="medium">中等</option>
          <option value="hard">困难</option>
        </select>
      </div>

      <div className="flex gap-2">
        <button
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          onClick={onCreateSmart}
        >
          <BookOpen className="w-5 h-5" /> 智能组卷
        </button>
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          onClick={onCreateManual}
        >
          <Plus className="w-5 h-5" /> 手动组卷
        </button>
      </div>
    </div>
  )
}
