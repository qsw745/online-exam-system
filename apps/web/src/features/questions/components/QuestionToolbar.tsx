import React from 'react'
import { Button, Input, Select } from 'antd'
import { Download, Plus, Trash2, Upload } from 'lucide-react'

const { Search } = Input

type Props = {
  search: string
  onSearch: (v: string) => void
  onQuery: () => void // ← 新增：点击“查询”或回车触发
  type: string
  onTypeChange: (v: string) => void
  selectedTags: string[]
  onTagsChange: (v: string[]) => void
  allTags: string[]
  onBatchDelete: () => void
  onOpenImport: () => void
  onOpenAdd: () => void
  onOpenExport: () => void
  selectedCount: number
}

export default function QuestionToolbar({
  search,
  onSearch,
  onQuery,
  type,
  onTypeChange,
  selectedTags,
  onTagsChange,
  allTags,
  onBatchDelete,
  onOpenImport,
  onOpenAdd,
  onOpenExport,
  selectedCount,
}: Props) {
  // 左侧筛选区与右侧操作区——用 flex + wrap，避免小屏溢出
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'stretch',
        justifyContent: 'space-between',
      }}
    >
      {/* 左侧：搜索 + 类型 + 标签 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', flex: '1 1 520px' }}>
        <Search
          placeholder="搜索题目..."
          value={search}
          onChange={e => onSearch(e.target.value)}
          onSearch={onQuery} // 支持回车或点按钮
          enterButton="查询" // ← 新增“查询”按钮
          allowClear
          style={{ flex: '1 1 280px', minWidth: 220, maxWidth: 520 }}
        />

        <Select
          value={type}
          onChange={onTypeChange}
          style={{ flex: '0 1 160px', minWidth: 140 }}
          options={[
            { value: 'all', label: '所有类型' },
            { value: 'single_choice', label: '单选题' },
            { value: 'multiple_choice', label: '多选题' },
            { value: 'true_false', label: '判断题' },
            { value: 'short_answer', label: '简答题' },
          ]}
        />

        <Select
          mode="multiple"
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="按标签筛选（可多选）"
          value={selectedTags}
          onChange={onTagsChange}
          notFoundContent="暂无数据" // ← 无数据时显示中文
          maxTagCount="responsive" // ← 自动收拢，避免挤爆布局
          dropdownMatchSelectWidth={false} // 更贴近触发器宽度
          style={{ flex: '1 1 260px', minWidth: 220, maxWidth: 520 }}
          options={allTags.map(t => ({ label: t, value: t }))}
        />
      </div>

      {/* 右侧：操作按钮（自动换行） */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'flex-end' }}>
        {selectedCount > 0 && (
          <Button danger icon={<Trash2 size={16} />} onClick={onBatchDelete}>
            批量删除 ({selectedCount})
          </Button>
        )}
        <Button icon={<Upload size={16} />} onClick={onOpenImport}>
          批量导入
        </Button>
        <Button icon={<Download size={16} />} onClick={onOpenExport}>
          批量导出
        </Button>
        <Button type="primary" icon={<Plus size={16} />} onClick={onOpenAdd}>
          新增题目
        </Button>
      </div>
    </div>
  )
}
