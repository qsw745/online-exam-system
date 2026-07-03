// src/features/exams/pages/ExamListPage.tsx

import { FilterOutlined, SearchOutlined } from '@ant-design/icons'
import { Card, Col, Empty, Input, Row, Select, Space, Typography } from 'antd'
import { BookOpen } from 'lucide-react'
import { ExamCard } from '../components/ExamCard'
import { useExams } from '../hooks/useExams'
import GlobalPagination from '@/shared/components/GlobalPagination'
import { translate } from '@/shared/utils/i18n'
const { Search } = Input
const { Option } = Select
const { Title, Paragraph } = Typography

export default function ExamListPage() {
  const { loading, items, total, page, limit, onSearch, onStatusChange, onPageChange } = useExams({
    page: 1,
    limit: 10,
    status: 'all',
  })

  return (
    <div style={{ padding: 8 }}>
      {/* 标题 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          {translate('menus.exam-list')}</Title>
        <Paragraph type="secondary" style={{ margin: '8px 0 0 0' }}>
          {translate('auto.4e26e794ed')}</Paragraph>
      </div>

      {/* 搜索 & 筛选 */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={16}>
            <Search
              placeholder={translate('auto.13f7816132')}
              onSearch={onSearch}
              prefix={<SearchOutlined />}
              allowClear
              size="large"
              loading={loading}
            />
          </Col>
          <Col xs={24} md={8}>
            <Space>
              <FilterOutlined style={{ color: '#8c8c8c' }} />
              <Select defaultValue="all" onChange={v => onStatusChange(v as any)} style={{ width: 120 }} size="large">
                <Option value="all">{translate('results.all_status')}</Option>
                <Option value="published">{translate('auto.176a2eb4eb')}</Option>
                <Option value="draft">{translate('auto.0f436818c0')}</Option>
                <Option value="reviewing">{translate('auto.fe58c849a9')}</Option>
                <Option value="approved">{translate('auto.3f3d8682dd')}</Option>
                <Option value="rejected">{translate('workflowTemplates.status.rejected')}</Option>
                <Option value="closed">{translate('auto.f628761bf5')}</Option>
                <Option value="archived">{translate('auto.5cfbea2b76')}</Option>
              </Select>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 列表 */}
      <div style={{ marginBottom: 24 }}>
        {items.length === 0 ? (
          <Empty
            image={<BookOpen size={64} style={{ color: '#d9d9d9' }} />}
            description={
              <span>
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>{translate('auto.4c6f95a2fc')}</div>
                <div style={{ color: '#8c8c8c' }}>{translate('auto.7b401ca588')}</div>
              </span>
            }
          />
        ) : (
          <Row gutter={[16, 16]}>
            {items.map(exam => (
              <Col xs={24} key={exam.id}>
                <ExamCard exam={exam} />
              </Col>
            ))}
          </Row>
        )}
      </div>

      {/* 分页 */}
      {total > limit && (
        <GlobalPagination total={total} current={page} pageSize={limit} onChange={onPageChange} />
      )}
    </div>
  )
}
