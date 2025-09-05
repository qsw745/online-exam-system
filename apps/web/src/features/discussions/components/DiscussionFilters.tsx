import React from 'react'
import { Button, Select } from 'antd'
import { Plus } from 'lucide-react'
import type { DiscussionCategory, SortBy } from '../types'

const { Option } = Select

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
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center space-x-3">
        <h1 className="text-2xl font-bold">讨论区</h1>
      </div>
      <div className="flex items-center space-x-4">
        <Select value={selectedCategory} onChange={onCategoryChange} style={{ width: 140 }}>
          <Option value="all">全部分类</Option>
          {categories.map(c => (
            <Option key={c.id} value={String(c.id)}>
              {c.name}
            </Option>
          ))}
        </Select>
        <Select value={sortBy} onChange={v => onSortChange(v as SortBy)} style={{ width: 140 }}>
          <Option value="latest">最新发布</Option>
          <Option value="hot">热门讨论</Option>
          <Option value="replies">回复最多</Option>
        </Select>
        <Button type="primary" icon={<Plus className="w-4 h-4" />} onClick={onCreate}>
          发起讨论
        </Button>
      </div>
    </div>
  )
}
