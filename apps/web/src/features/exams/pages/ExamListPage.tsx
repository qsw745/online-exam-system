// src/features/exams/pages/ExamListPage.tsx
import React from 'react'
import { FilterOutlined, SearchOutlined } from '@ant-design/icons'
import { Button, Card, Col, Empty, Input, Pagination, Row, Select, Space, Typography } from 'antd'
import { BookOpen } from 'lucide-react'
import { createPaginationConfig } from '@shared/constants/pagination'
import { useExams } from '../hooks/useExams'
import { ExamCard } from '../components/ExamCard'
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
    <div style={{ padding: 24 }}>
      {/* 标题 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          考试列表
        </Title>
        <Paragraph type="secondary" style={{ margin: '8px 0 0 0' }}>
          查看和参加可用的考试
        </Paragraph>
      </div>

      {/* 搜索 & 筛选 */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={16}>
            <Search
              placeholder="搜索考试..."
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
                <Option value="all">所有状态</Option>
                <Option value="published">已发布</Option>
                <Option value="draft">草稿</Option>
                <Option value="archived">已归档</Option>
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
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>暂无考试</div>
                <div style={{ color: '#8c8c8c' }}>当前没有可用的考试</div>
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
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
          <Pagination
            current={page}
            total={total}
            pageSize={limit}
            onChange={onPageChange}
            showSizeChanger
            {...createPaginationConfig({ pageSizeOptions: ['6', '10', '12', '18', '24'] })}
          />
        </div>
      )}
    </div>
  )
}
