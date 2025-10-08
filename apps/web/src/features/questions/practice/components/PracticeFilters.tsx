import React, { useRef, useState } from 'react'
import { Button, Card, Col, Input, Row, Select, Segmented, Space, Typography } from 'antd'
import type { Difficulty, QuestionType } from '@/features/questions/practice/hooks/usePracticeList'

const { Text } = Typography

// 和后端保持一致的取值
const TYPE_OPTIONS = [
  { value: 'single_choice', label: '单选题' },
  { value: 'multiple_choice', label: '多选题' },
  { value: 'true_false', label: '判断题' },
  { value: 'short_answer', label: '简答题' },
] as const

const DIFF_OPTIONS = [
  { value: 'all', label: '全部难度' },
  { value: 'easy', label: '简单' },
  { value: 'medium', label: '中等' },
  { value: 'hard', label: '困难' },
] as const

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

  return (
    <Card>
      {/* 第 1 行：搜索 + 练习模式/按钮 */}
      <Row gutter={[12, 12]} align="middle">
        <Col xs={24} lg={12}>
          <Input.Search
            allowClear
            placeholder="搜索题目/关键词"
            value={search}
            onChange={e => onSearch(e.target.value)}
            onSearch={kw => onSearch(kw)}
            enterButton="查询"
          />
        </Col>
        <Col xs={24} lg={12}>
          <Space wrap style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Text type="secondary">练习模式：</Text>
            <Segmented
              value={mode}
              onChange={v => setMode(v as any)}
              options={[
                { label: '单题', value: 'single' },
                { label: '多题', value: 'bulk' },
              ]}
            />
            {mode === 'bulk' ? (
              <Button type="primary" onClick={onEnterBulk}>
                开始多题练习
              </Button>
            ) : (
              <Button type="primary" onClick={() => onEnterSingle(firstCardIndex.current)}>
                开始单题练习
              </Button>
            )}
          </Space>
        </Col>
      </Row>

      {/* 第 2 行：题型(多选) + 难度 */}
      <Row gutter={[12, 12]} align="middle" style={{ marginTop: 8 }}>
        <Col xs={24} lg={12}>
          <Space wrap>
            <Text type="secondary">题型：</Text>
            <Select
              mode="multiple"
              allowClear
              style={{ minWidth: 280 }}
              placeholder="选择题型（可多选）"
              value={types as string[]}
              // antd onChange推断为string[]，这里断言回到QuestionType[]
              onChange={vals => onTypesChange(vals as QuestionType[])}
              maxTagCount="responsive"
              options={TYPE_OPTIONS as any}
            />
            {/* “全部类型”快捷按钮：清空选择 */}
            <Button onClick={() => onTypesChange([])}>全部类型</Button>
          </Space>
        </Col>
        <Col xs={24} lg={12}>
          <Space wrap style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Text type="secondary">难度：</Text>
            <Select
              value={difficulty}
              style={{ width: 140 }}
              // antd onChange推断为string，这里断言回到Difficulty
              onChange={v => onDifficultyChange(v as Difficulty)}
              options={DIFF_OPTIONS as any}
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
            placeholder="按标签筛选（可多选）"
            options={allTags.map(t => ({ label: t, value: t }))}
            style={{ width: '100%' }}
            maxTagCount="responsive"
            notFoundContent="暂无数据"
            showSearch
            optionFilterProp="label"
          />
        </Col>
      </Row>
    </Card>
  )
}
