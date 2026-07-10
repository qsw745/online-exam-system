import React from 'react'
import { Button, Segmented, Select } from 'antd'
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

const sortLabel = (icon: React.ReactNode, text: string) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
    {icon}
    {text}
  </span>
)

export const DiscussionFilters: React.FC<Props> = ({
  categories,
  selectedCategory,
  sortBy,
  onCategoryChange,
  onSortChange,
  onCreate,
}) => {
  return (
    <div className="disc-toolbar">
      <div className="disc-toolbar__filters">
        <Segmented
          value={sortBy}
          onChange={v => onSortChange(v as SortBy)}
          options={[
            { value: 'latest', label: sortLabel(<Clock3 size={14} />, translate('auto.7e805a1230')) },
            { value: 'hot', label: sortLabel(<Flame size={14} />, translate('auto.86d011b489')) },
            { value: 'replies', label: sortLabel(<MessageSquareMore size={14} />, translate('auto.909888e4fc')) },
          ]}
        />
        <Select
          value={selectedCategory}
          onChange={onCategoryChange}
          style={{ width: 180 }}
          placeholder={translate('auto.3759bf861f')}
          popupMatchSelectWidth={240}
          options={[
            { value: 'all', label: translate('auto.a8e369c4b6') },
            ...categories.map(c => ({
              value: String(c.id),
              label: c.name || `分类 #${c.id}`,
            })),
          ]}
        />
      </div>

      <Button type="primary" icon={<Plus size={16} />} onClick={onCreate}>
        {translate('auto.85f5cb8f6e')}
      </Button>
    </div>
  )
}
