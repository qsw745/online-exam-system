// src/features/exams/pages/ResultsPage.tsx
import { useAuth } from '@shared/contexts/AuthContext'
import { useLanguage } from '@shared/contexts/LanguageContext'
import { Card, Col, Empty, Pagination, Row, Space, Spin, Typography } from 'antd'
import { BookmarkPlus } from 'lucide-react'
import { createPaginationConfig } from '@shared/constants/pagination'
import { useResults } from '@shared/hooks/useResults'
import ResultsFilters from '../components/ResultsFilters'
import ResultCard from '../components/ResultCard'

const { Title, Text } = Typography

export default function ResultsPage() {
  const { user } = useAuth()
  const { t, language } = useLanguage()
  const { loading, items, page, limit, total, searchTerm, status, setPage, onSearch, onStatusChange } = useResults(12)

  const getStatusLabel = (s: string) =>
    ({
      completed: t('results.status_completed'),
      in_progress: t('results.status_in_progress'),
      not_started: t('results.status_not_started'),
    }[s as keyof any] || s)

  const getStatusTagColor = (s: string) =>
    (({ completed: 'success', in_progress: 'warning', not_started: 'default' } as const)[s as keyof any] || 'default')

  if (loading && items.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <Spin size="large" tip={t('results.loading')}>
          <div style={{ minHeight: 200, minWidth: 200 }} />
        </Spin>
      </div>
    )
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%', padding: 24 }}>
      {/* 标题 */}
      <div>
        <Title level={2}>{t('results.title')}</Title>
        <Text type="secondary">{t('results.description')}</Text>
      </div>

      {/* 筛选 */}
      <ResultsFilters
        search={searchTerm}
        status={status}
        onSearchChange={onSearch}
        onStatusChange={onStatusChange}
        placeholder={t('results.search_placeholder')}
        allStatusText={t('results.all_status')}
        textCompleted={t('results.status_completed')}
        textInProgress={t('results.status_in_progress')}
        textNotStarted={t('results.status_not_started')}
      />

      {/* 列表 */}
      <Row gutter={[16, 16]}>
        {items.map(item => (
          <Col key={item.id} xs={24} md={12} lg={8}>
            <ResultCard
              result={item}
              statusLabel={getStatusLabel}
              statusTagColor={getStatusTagColor}
              locale={language === 'zh-CN' ? 'zh-CN' : 'en-US'}
            />
          </Col>
        ))}
      </Row>

      {/* 空状态 */}
      {items.length === 0 && (
        <Empty
          image={<BookmarkPlus style={{ width: 48, height: 48, color: '#d9d9d9' }} />}
          description={
            <Space direction="vertical">
              <Text strong>{t('results.no_records')}</Text>
              <Text type="secondary">{t('results.no_records_desc')}</Text>
            </Space>
          }
        />
      )}

      {/* 分页 */}
      {total > limit && (
        <Card>
          <Pagination
            current={page}
            total={total}
            pageSize={limit}
            onChange={setPage}
            {...createPaginationConfig({ showSizeChanger: false })}
          />
        </Card>
      )}
    </Space>
  )
}
