// src/features/questions/practice/components/PracticeFilters.tsx
import React, { useRef, useState } from 'react'
import { Button, Card, Col, Input, Row, Segmented, Space, Typography } from 'antd'

const { Text } = Typography

const TYPE_OPTIONS = [
  { value: 'all', label: '全部类型' },
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
  type: string
  difficulty: string
  search: string
  onTypeChange: (v: any) => void
  onDifficultyChange: (v: any) => void
  onSearch: (kw: string) => void
  onEnterSingle: (startIndex: number) => void
  onEnterBulk: () => void
}

export default function PracticeFilters(props: Props) {
  const { type, difficulty, search, onTypeChange, onDifficultyChange, onSearch, onEnterSingle, onEnterBulk } = props
  const [mode, setMode] = useState<'single' | 'bulk'>('single')
  const firstCardIndex = useRef(0)

  return (
    <Card>
      <Row gutter={[12, 12]} align="middle">
        <Col xs={24} md={10}>
          <Input.Search
            allowClear
            placeholder="搜索题目/关键词"
            value={search}
            onChange={e => onSearch(e.target.value)}
            onSearch={kw => onSearch(kw)}
          />
        </Col>
        <Col xs={24} md={14}>
          <Space wrap style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Text type="secondary">题型：</Text>
            <Segmented value={type} options={TYPE_OPTIONS as any} onChange={onTypeChange} />

            <Text type="secondary">难度：</Text>
            <Segmented value={difficulty} options={DIFF_OPTIONS as any} onChange={onDifficultyChange} />

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
    </Card>
  )
}
