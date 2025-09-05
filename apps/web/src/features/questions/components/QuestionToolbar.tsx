import { Button, Input, Select, Space } from 'antd'
import { Plus, Trash2, Upload } from 'lucide-react'
import React from 'react'
const { Search } = Input

export default function QuestionToolbar({
  search,
  onSearch,
  type,
  onTypeChange,
  selectedTags,
  onTagsChange,
  allTags,
  onBatchDelete,
  onOpenImport,
  onOpenAdd,
  selectedCount,
}: {
  search: string
  onSearch: (v: string) => void
  type: string
  onTypeChange: (v: string) => void
  selectedTags: string[]
  onTagsChange: (v: string[]) => void
  allTags: string[]
  onBatchDelete: () => void
  onOpenImport: () => void
  onOpenAdd: () => void
  selectedCount: number
}) {
  return (
    <Space className="w-full" align="center" style={{ justifyContent: 'space-between' }}>
      <Space>
        <Search
          placeholder="搜索题目..."
          value={search}
          onChange={e => onSearch(e.target.value)}
          style={{ width: 300 }}
          allowClear
        />
        <Select value={type} onChange={onTypeChange} style={{ width: 150 }}>
          <Select.Option value="all">所有类型</Select.Option>
          <Select.Option value="single_choice">单选题</Select.Option>
          <Select.Option value="multiple_choice">多选题</Select.Option>
          <Select.Option value="true_false">判断题</Select.Option>
          <Select.Option value="short_answer">简答题</Select.Option>
        </Select>
        <Select
          mode="multiple"
          allowClear
          placeholder="按标签筛选（可多选）"
          value={selectedTags}
          onChange={onTagsChange}
          style={{ minWidth: 260 }}
          options={allTags.map(t => ({ label: t, value: t }))}
        />
      </Space>
      <Space>
        {selectedCount > 0 && (
          <Button danger icon={<Trash2 size={16} />} onClick={onBatchDelete}>
            批量删除 ({selectedCount})
          </Button>
        )}
        <Button icon={<Upload size={16} />} onClick={onOpenImport}>
          批量导入
        </Button>
        <Button type="primary" icon={<Plus size={16} />} onClick={onOpenAdd}>
          新增题目
        </Button>
      </Space>
    </Space>
  )
}
