// src/features/exams/components/ResultsFilters.tsx
import { Card, Col, Input, Row, Select, Space } from 'antd'
import { Filter, Search } from 'lucide-react'
const { Option } = Select

type Props = {
  search: string
  status: 'all' | 'completed' | 'in_progress' | 'not_started'
  onSearchChange: (v: string) => void
  onStatusChange: (v: Props['status']) => void
  placeholder: string
  allStatusText: string
  textCompleted: string
  textInProgress: string
  textNotStarted: string
}

export default function ResultsFilters({
  search,
  status,
  onSearchChange,
  onStatusChange,
  placeholder,
  allStatusText,
  textCompleted,
  textInProgress,
  textNotStarted,
}: Props) {
  return (
    <Card>
      <Row gutter={[16, 16]} align="middle">
        <Col xs={24} md={16}>
          <Input
            prefix={<Search style={{ width: 16, height: 16, color: '#999' }} />}
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder={placeholder}
            allowClear
          />
        </Col>
        <Col xs={24} md={8}>
          <Space>
            <Filter style={{ width: 16, height: 16, color: '#999' }} />
            <Select value={status} onChange={onStatusChange} style={{ width: 200 }}>
              <Option value="all">{allStatusText}</Option>
              <Option value="completed">{textCompleted}</Option>
              <Option value="in_progress">{textInProgress}</Option>
              <Option value="not_started">{textNotStarted}</Option>
            </Select>
          </Space>
        </Col>
      </Row>
    </Card>
  )
}
