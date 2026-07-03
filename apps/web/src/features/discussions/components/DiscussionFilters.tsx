import React from 'react'
import { Button, Select, Tooltip } from 'antd'
import { Plus, Flame, Clock3, MessageSquareMore } from 'lucide-react'
import { translate } from '@/shared/utils/i18n'

export type SortBy = 'latest' | 'hot' | 'replies'
export type DiscussionCategory = { id: number; name?: string }

type Props = {
  categories: DiscussionCategory[]
  selectedCategory: string
  sortBy: SortBy
  onCategoryChange: (v: string) => void
  onSortChange: (v: SortBy) => void
  onCreate: () => void
}

/** 自定义的排序按钮组（替代 Segmented） */
const SortButtons: React.FC<{
  value: SortBy
  onChange: (v: SortBy) => void
}> = ({ value, onChange }) => {
  const btns: { key: SortBy; label: React.ReactNode }[] = [
    {
      key: 'latest',
      label: (
        <div className="flex items-center gap-1">
          <Clock3 className="w-4 h-4" />
          {translate('auto.7e805a1230')}</div>
      ),
    },
    {
      key: 'hot',
      label: (
        <div className="flex items-center gap-1">
          <Flame className="w-4 h-4" />
          {translate('auto.86d011b489')}</div>
      ),
    },
    {
      key: 'replies',
      label: (
        <div className="flex items-center gap-1">
          <MessageSquareMore className="w-4 h-4" />
          {translate('auto.909888e4fc')}</div>
      ),
    },
  ]

  return (
    <div className="flex rounded-lg overflow-hidden border border-gray-200">
      {btns.map((b, i) => {
        const active = value === b.key
        return (
          <button
            key={b.key}
            onClick={() => onChange(b.key)}
            className={`px-3 py-1.5 text-sm flex items-center gap-1 transition-colors ${
              active ? 'bg-blue-500 text-white' : 'bg-white hover:bg-gray-50 text-gray-600'
            } ${i !== btns.length - 1 ? 'border-r border-gray-200' : ''}`}
          >
            {b.label}
          </button>
        )
      })}
    </div>
  )
}

export const DiscussionFilters: React.FC<Props> = ({
  categories,
  selectedCategory,
  sortBy,
  onCategoryChange,
  onSortChange,
  onCreate,
}) => {
  return (
    <div className="mb-4">
      <div className="rounded-2xl border bg-white shadow-sm px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-sm text-gray-500">{translate('app.sort')}</div>

          {/* ✅ 改用自定义按钮组 */}
          <SortButtons value={sortBy} onChange={onSortChange} />

          <div className="hidden md:block h-6 w-px bg-gray-200 mx-1" />

          {/* 分类下拉框 */}
          <Select
            value={selectedCategory}
            onChange={onCategoryChange}
            style={{ width: 200 }}
            placeholder={translate('auto.3759bf861f')}
            popupMatchSelectWidth={260}
            options={[
              { value: 'all', label: translate('auto.a8e369c4b6') },
              ...categories.map(c => ({
                value: String(c.id),
                label: c.name || `分类 #${c.id}`,
              })),
            ]}
          />
        </div>

        <div className="flex items-center gap-3">
          <Tooltip title={translate('auto.14478a55e8')}>
            <Button type="primary" icon={<Plus className="w-4 h-4" />} onClick={onCreate}>
              {translate('auto.85f5cb8f6e')}</Button>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
