// apps/web/src/features/analytics/components/GradeFilters.tsx
import React, { FormEvent } from 'react'
import { Button, Col, Input, Row, Select, Space, Typography } from 'antd'
import { DownloadOutlined, SearchOutlined } from '@ant-design/icons'
import type { PaperLite } from '@/shared/types/grades'
import { translate } from '@/shared/utils/i18n'

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
            placeholder={translate('auto.d761e8f9a3')}
            value={searchTerm}
            onChange={e => onSearchChange(e.target.value)}
            suffix={<SearchOutlined />}
          />
        </Col>
        <Col xs={24} md={5}>
          <Select value={filterPaper} onChange={onFilterPaper} style={{ width: '100%' }} placeholder={translate('auto.237ab680f8')}>
            <Option value="all">{translate('auto.f4769c19fd')}</Option>
            {papers.map(p => (
              <Option key={p.id} value={String(p.id)}>
                {p.title}
              </Option>
            ))}
          </Select>
        </Col>
        <Col xs={24} md={5}>
          <Select value={filterStatus} onChange={onFilterStatus} style={{ width: '100%' }} placeholder={translate('auto.315f5ee18b')}>
            <Option value="all">{translate('results.all_status')}</Option>
            <Option value="completed">{translate('dashboard.status_completed')}</Option>
            <Option value="in_progress">{translate('dashboard.status_in_progress')}</Option>
            <Option value="not_started">{translate('dashboard.status_not_started')}</Option>
          </Select>
        </Col>
        <Col xs="auto">
          <Space>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
              {translate('auto.711363c424')}</Button>
            <Button icon={<DownloadOutlined />} onClick={onExport} loading={exporting}>
              {translate('questions.export')}</Button>
          </Space>
        </Col>
        <Col flex="auto">
          <Text type="secondary" style={{ float: 'right' }}>
            {translate('auto.0730c223b6')}</Text>
        </Col>
      </Row>
    </form>
  )
}
