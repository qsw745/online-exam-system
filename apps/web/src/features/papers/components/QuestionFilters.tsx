import { Input, Select, Space } from 'antd'

export default function QuestionFilters({
  keyword,
  onKeywordChange,
  type,
  onTypeChange,
  difficulty,
  onDifficultyChange,
}: {
  keyword: string
  onKeywordChange: (v: string) => void
  type: string
  onTypeChange: (v: string) => void
  difficulty: string
  onDifficultyChange: (v: string) => void
}) {
  return (
    <Space wrap style={{ width: '100%' }}>
      <Input
        placeholder="搜索题目..."
        value={keyword}
        onChange={e => onKeywordChange(e.target.value)}
        style={{ minWidth: 220 }}
      />
      <Select
        value={type}
        onChange={onTypeChange}
        style={{ width: 180 }}
        options={[
          { label: '全部类型', value: 'all' },
          { label: '单选题', value: 'single' },
          { label: '多选题', value: 'multiple' },
          { label: '判断题', value: 'judge' },
        ]}
      />
      <Select
        value={difficulty}
        onChange={onDifficultyChange}
        style={{ width: 180 }}
        options={[
          { label: '全部难度', value: 'all' },
          { label: '简单', value: 'easy' },
          { label: '中等', value: 'medium' },
          { label: '困难', value: 'hard' },
        ]}
      />
    </Space>
  )
}
