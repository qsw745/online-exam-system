import React from 'react'
import { Button, Segmented, Select, Tooltip } from 'antd'
import { Plus, Flame, Clock3, MessageSquareMore } from 'lucide-react'

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
          <div className="text-sm text-gray-500">排序</div>
          <Segmented
            value={sortBy}
            onChange={v => onSortChange(v as SortBy)}
            options={[
              {
                label: (
                  <div className="flex items-center gap-1">
                    <Clock3 className="w-4 h-4" />
                    最新
                  </div>
                ),
                value: 'latest',
              },
              {
                label: (
                  <div className="flex items-center gap-1">
                    <Flame className="w-4 h-4" />
                    最热
                  </div>
                ),
                value: 'hot',
              },
              {
                label: (
                  <div className="flex items-center gap-1">
                    <MessageSquareMore className="w-4 h-4" />
                    回复最多
                  </div>
                ),
                value: 'replies',
              },
            ]}
          />

          <div className="hidden md:block h-6 w-px bg-gray-200 mx-1" />

          {/* 关键修复：使用 options 明确 label/value，且兼容 name 缺失 */}
          <Select
            value={selectedCategory}
            onChange={onCategoryChange}
            style={{ width: 200 }}
            placeholder="选择分类"
            popupMatchSelectWidth={260}
            options={[
              { value: 'all', label: '全部分类' },
              ...categories.map(c => ({
                value: String(c.id),
                label: c.name || `分类 #${c.id}`,
              })),
            ]}
          />
        </div>

        <div className="flex items-center gap-3">
          <Tooltip title="发起一个新话题">
            <Button type="primary" icon={<Plus className="w-4 h-4" />} onClick={onCreate}>
              发起讨论
            </Button>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
