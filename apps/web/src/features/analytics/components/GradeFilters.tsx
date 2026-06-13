// apps/web/src/features/analytics/components/GradeFilters.tsx
import React, { FormEvent } from 'react'
import { Button, Col, Input, Row, Select, Space, Typography } from 'antd'
import { DownloadOutlined, SearchOutlined } from '@ant-design/icons'
import type { PaperLite } from '@/shared/types/grades'

const { Option } = Select
const { Text } = Typography

type Props = {
  searchTerm: string
  onSearchChange: (v: string) => void
  onSearchSubmit: () => void
  papers: PaperLite[]
  filterPaper: string
  filterStatus: string
  onFilterPaper: (v: string) => void
  onFilterStatus: (v: string) => void
  onExport: () => void
  exporting?: boolean
}

export const GradeFilters: React.FC<Props> = ({
  searchTerm,
  onSearchChange,
  onSearchSubmit,
  papers,
  filterPaper,
  filterStatus,
  onFilterPaper,
  onFilterStatus,
  onExport,
  exporting,
}) => {
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSearchSubmit()
  }

  return (
    <form onSubmit={submit}>
      <Row gutter={[12, 12]} align="middle" wrap>
        <Col xs={24} md={10}>
          <Input
            allowClear
            size="middle"
            placeholder="搜索学生姓名或邮箱..."
            value={searchTerm}
            onChange={e => onSearchChange(e.target.value)}
            suffix={<SearchOutlined />}
          />
        </Col>
        <Col xs={24} md={5}>
          <Select value={filterPaper} onChange={onFilterPaper} style={{ width: '100%' }} placeholder="选择试卷">
            <Option value="all">所有试卷</Option>
            {papers.map(p => (
              <Option key={p.id} value={String(p.id)}>
                {p.title}
              </Option>
            ))}
          </Select>
        </Col>
        <Col xs={24} md={5}>
          <Select value={filterStatus} onChange={onFilterStatus} style={{ width: '100%' }} placeholder="选择状态">
            <Option value="all">所有状态</Option>
            <Option value="completed">已完成</Option>
            <Option value="in_progress">进行中</Option>
            <Option value="not_started">未开始</Option>
          </Select>
        </Col>
        <Col xs="auto">
          <Space>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
              查询
            </Button>
            <Button icon={<DownloadOutlined />} onClick={onExport} loading={exporting}>
              导出
            </Button>
          </Space>
        </Col>
        <Col flex="auto">
          <Text type="secondary" style={{ float: 'right' }}>
            可通过左侧搜索与筛选快速定位成绩
          </Text>
        </Col>
      </Row>
    </form>
  )
}
