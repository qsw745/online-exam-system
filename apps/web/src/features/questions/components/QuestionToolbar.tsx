import React from 'react'
import { Button, Input, Select } from 'antd'
import { Download, Plus, Trash2, Upload, CopyCheck } from 'lucide-react'
import { useLanguage } from '@/shared/contexts/LanguageContext'

const { Search } = Input

type Props = {
  search: string
  onSearch: (v: string) => void
  onQuery: () => void
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
  dupOnly: boolean
  onToggleDup: (next: boolean) => void
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
  dupOnly,
  onToggleDup,
}: Props) {
  const { t } = useLanguage()
  // 本地关键字，只在点击“查询”时提交
  const [keyword, setKeyword] = React.useState(search)
  React.useEffect(() => setKeyword(search ?? ''), [search])

  const submitQuery = React.useCallback(
    (v?: string) => {
      const k = typeof v === 'string' ? v : keyword
      onSearch(k ?? '')
      onQuery()
    },
    [keyword, onSearch, onQuery]
  )

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        // ★ 永远单行
        flexWrap: 'nowrap',
        // ★ 宽度不够时，横向滚动，不换行
        overflowX: 'auto',
      }}
    >
      {/* 左侧：搜索 + 类型 + 标签（单行，不换行） */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flex: 1,
          // ★ 允许子项在单行下收缩
          minWidth: 0,
          // ★ 不换行
          flexWrap: 'nowrap',
        }}
      >
        <Search
          placeholder={t('questions.mgmt_search')}
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onSearch={v => submitQuery(v)}
          enterButton={t('app.search')}
          allowClear
          // ★ 占据剩余空间，可收缩
          style={{ flex: '1 1 420px', minWidth: 220 }}
        />

        <Select
          value={type}
          onChange={onTypeChange}
          // ★ 固定宽度，不会把行撑高
          style={{ flex: '0 0 160px' }}
          options={[
            { value: 'all', label: t('questions.type_all') },
            { value: 'single_choice', label: t('questions.type_single') },
            { value: 'multiple_choice', label: t('questions.type_multiple') },
            { value: 'true_false', label: t('questions.type_true_false') },
            { value: 'short_answer', label: t('questions.type_short') },
          ]}
        />

        <Select
          mode="multiple"
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder={t('questions.filter_by_tag')}
          value={selectedTags}
          onChange={onTagsChange}
          notFoundContent={t('common.no_data')}
          maxTagCount="responsive"
          popupMatchSelectWidth={false}
          // ★ 可收缩的固定基准宽度
          style={{ flex: '0 1 340px', minWidth: 180 }}
          options={allTags.map(t => ({ label: t, value: t }))}
        />
      </div>

      {/* 右侧：操作按钮（单行，不换行） */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flex: '0 0 auto',
          // ★ 防止按钮组自身换行
          flexWrap: 'nowrap',
          whiteSpace: 'nowrap',
        }}
      >
        <Button
          type={dupOnly ? 'primary' : 'default'}
          ghost={dupOnly}
          icon={<CopyCheck size={16} />}
          onClick={() => onToggleDup(!dupOnly)}
        >
          {dupOnly ? t('questions.dup_only_on') : t('questions.dup_only')}
        </Button>

        {selectedCount > 0 && (
          <Button danger icon={<Trash2 size={16} />} onClick={onBatchDelete}>
            {t('questions.batch_delete')} ({selectedCount})
          </Button>
        )}
        <Button icon={<Upload size={16} />} onClick={onOpenImport}>
          {t('questions.batch_import')}
        </Button>
        <Button icon={<Download size={16} />} onClick={onOpenExport}>
          {t('questions.batch_export')}
        </Button>
        <Button type="primary" icon={<Plus size={16} />} onClick={onOpenAdd}>
          {t('questions.add')}
        </Button>
      </div>
    </div>
  )
}
