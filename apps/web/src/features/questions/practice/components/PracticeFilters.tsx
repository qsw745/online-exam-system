import React, { useRef, useState } from 'react'
import { Button, Card, Col, Input, Row, Select, Segmented, Space, Typography } from 'antd'
import type { Difficulty, QuestionType } from '@/features/questions/practice/hooks/usePracticeList'
import { translate } from '@/shared/utils/i18n'

const { Text } = Typography

type Props = {
  /** ✅ 多选题型（精确类型） */
  types: QuestionType[]
  difficulty: Difficulty
  search: string
  selectedTags: string[]
  allTags: string[]

  /** 回调（精确类型） */
  onTypesChange: (v: QuestionType[]) => void
  onDifficultyChange: (v: Difficulty) => void
  onSearch: (kw: string) => void
  onTagsChange: (tags: string[]) => void
  onEnterSingle: (startIndex: number) => void
  onEnterBulk: () => void
}

export default function PracticeFilters({
  types,
  difficulty,
  search,
  selectedTags,
  allTags,
  onTypesChange,
  onDifficultyChange,
  onSearch,
  onTagsChange,
  onEnterSingle,
  onEnterBulk,
}: Props) {
  const [mode, setMode] = useState<'single' | 'bulk'>('single')
  const firstCardIndex = useRef(0)
  // 和后端保持一致的取值
  const typeOptions = [
    { value: 'single_choice', label: translate('questions.single_choice') },
    { value: 'multiple_choice', label: translate('questions.multiple_choice') },
    { value: 'true_false', label: translate('questions.judge') },
    { value: 'short_answer', label: translate('questions.type_short') },
  ] as const
  const difficultyOptions = [
    { value: 'all', label: translate('auto.0ab824ba71') },
    { value: 'easy', label: translate('questions.easy') },
    { value: 'medium', label: translate('questions.medium') },
    { value: 'hard', label: translate('questions.hard') },
  ] as const

  return (
    <Card>
      {/* 第 1 行：搜索 + 练习模式/按钮 */}
      <Row gutter={[12, 12]} align="middle">
        <Col xs={24} lg={12}>
          <Input.Search
            allowClear
            placeholder={translate('auto.ec3e221330')}
            value={search}
            onChange={e => onSearch(e.target.value)}
            onSearch={kw => onSearch(kw)}
            enterButton={translate('auto.711363c424')}
          />
        </Col>
        <Col xs={24} lg={12}>
          <Space wrap style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Text type="secondary">{translate('auto.4484498f44')}</Text>
            <Segmented
              value={mode}
              onChange={v => setMode(v as any)}
              options={[
                { label: translate('auto.5840891d40'), value: 'single' },
                { label: translate('auto.8e224be5db'), value: 'bulk' },
              ]}
            />
            {mode === 'bulk' ? (
              <Button type="primary" onClick={onEnterBulk}>
                {translate('auto.221f7f5ae5')}</Button>
            ) : (
              <Button type="primary" onClick={() => onEnterSingle(firstCardIndex.current)}>
                {translate('auto.f79ce1cf2c')}</Button>
            )}
          </Space>
        </Col>
      </Row>

      {/* 第 2 行：题型(多选) + 难度 */}
      <Row gutter={[12, 12]} align="middle" style={{ marginTop: 8 }}>
        <Col xs={24} lg={12}>
          <Space wrap>
            <Text type="secondary">{translate('auto.bdc36ea3d9')}</Text>
            <Select
              mode="multiple"
              allowClear
              style={{ minWidth: 280 }}
              placeholder={translate('auto.79b46fdca0')}
              value={types as string[]}
              // antd onChange推断为string[]，这里断言回到QuestionType[]
              onChange={vals => onTypesChange(vals as QuestionType[])}
              maxTagCount="responsive"
              options={typeOptions as any}
            />
            {/* “全部类型”快捷按钮：清空选择 */}
            <Button onClick={() => onTypesChange([])}>{translate('auto.fa6968d9f0')}</Button>
          </Space>
        </Col>
        <Col xs={24} lg={12}>
          <Space wrap style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Text type="secondary">{translate('auto.08a090d362')}</Text>
            <Select
              value={difficulty}
              style={{ width: 140 }}
              // antd onChange推断为string，这里断言回到Difficulty
              onChange={v => onDifficultyChange(v as Difficulty)}
              options={difficultyOptions as any}
            />
          </Space>
        </Col>
      </Row>

      {/* 第 3 行：标签 */}
      <Row gutter={[12, 12]} style={{ marginTop: 8 }}>
        <Col span={24}>
          <Select
            mode="multiple"
            allowClear
            value={selectedTags}
            onChange={onTagsChange}
            placeholder={translate('questions.filter_by_tag')}
            options={allTags.map(t => ({ label: t, value: t }))}
            style={{ width: '100%' }}
            maxTagCount="responsive"
            notFoundContent={translate('common.no_data')}
            showSearch
            optionFilterProp="label"
          />
        </Col>
      </Row>
    </Card>
  )
}
