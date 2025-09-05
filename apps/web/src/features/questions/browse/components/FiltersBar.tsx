// components/FiltersBar.tsx
import { Filter, Search } from 'lucide-react'
import { Col, Input, Row, Select, Space } from 'antd'
import React from 'react'

export function FiltersBar({
  search,
  onSearchChange,
  type,
  onTypeChange,
  diff,
  onDiffChange,
  searchPlaceholder,
  typeLabels,
  diffLabels,
}: {
  search: string
  onSearchChange: (v: string) => void
  type: string
  onTypeChange: (v: string) => void
  diff: string
  onDiffChange: (v: string) => void
  searchPlaceholder: string
  typeLabels: Record<string, string>
  diffLabels: Record<string, string>
}) {
  return (
    <Row gutter={[16, 16]} align="middle">
      <Col xs={24} md={12}>
        <Input
          prefix={<Search size={16} color="#999" />}
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          allowClear
        />
      </Col>
      <Col xs={24} md={12}>
        <Space>
          <Space>
            <Filter size={16} color="#999" />
            <Select value={type} onChange={onTypeChange} style={{ width: 150 }}>
              <Select.Option value="all">所有类型</Select.Option>
              <Select.Option value="single_choice">{typeLabels.single_choice}</Select.Option>
              <Select.Option value="multiple_choice">{typeLabels.multiple_choice}</Select.Option>
              <Select.Option value="true_false">{typeLabels.true_false}</Select.Option>
              <Select.Option value="short_answer">{typeLabels.short_answer}</Select.Option>
            </Select>
          </Space>
          <Select value={diff} onChange={onDiffChange} style={{ width: 120 }}>
            <Select.Option value="all">所有难度</Select.Option>
            <Select.Option value="easy">{diffLabels.easy}</Select.Option>
            <Select.Option value="medium">{diffLabels.medium}</Select.Option>
            <Select.Option value="hard">{diffLabels.hard}</Select.Option>
          </Select>
        </Space>
      </Col>
    </Row>
  )
}
