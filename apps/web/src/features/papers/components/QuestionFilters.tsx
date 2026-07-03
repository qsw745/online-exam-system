import { Input, Select, Space } from 'antd'
import { translate } from '@/shared/utils/i18n'

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
        placeholder={translate('auto.c144b25327')}
        value={keyword}
        onChange={e => onKeywordChange(e.target.value)}
        style={{ minWidth: 220 }}
      />
      <Select
        value={type}
        onChange={onTypeChange}
        style={{ width: 180 }}
        options={[
          { label: translate('auto.fa6968d9f0'), value: 'all' },
          { label: translate('questions.single_choice'), value: 'single' },
          { label: translate('questions.multiple_choice'), value: 'multiple' },
          { label: translate('questions.judge'), value: 'judge' },
        ]}
      />
      <Select
        value={difficulty}
        onChange={onDifficultyChange}
        style={{ width: 180 }}
        options={[
          { label: translate('auto.0ab824ba71'), value: 'all' },
          { label: translate('questions.easy'), value: 'easy' },
          { label: translate('questions.medium'), value: 'medium' },
          { label: translate('questions.hard'), value: 'hard' },
        ]}
      />
    </Space>
  )
}
