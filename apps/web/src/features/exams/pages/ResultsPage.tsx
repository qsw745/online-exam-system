import { useAuth } from '@/shared/contexts/AuthContext'
import { useLanguage } from '@/shared/contexts/LanguageContext'
import { Card, Col, Empty, Pagination, Row, Space, Spin, Typography } from 'antd'
import { BookmarkPlus } from 'lucide-react'
import { createPaginationConfig } from '@/shared/constants/pagination'
import { useResults } from '@/shared/hooks/useResults'
import ResultsFilters from '../components/ResultsFilters'
import ResultCard from '../components/ResultCard'

const { Title, Text } = Typography

export default function ResultsPage() {
  useAuth() // 确保登录态
  const { t, language } = useLanguage()
  const { loading, items, page, limit, total, searchTerm, status, setPage, onSearch, onStatusChange } = useResults(12)

  const getStatusLabel = (s: string) =>
    ({
      completed: t('results.status_completed'),
      in_progress: t('results.status_in_progress'),
      not_started: t('results.status_not_started'),
    }[s as keyof any] ||
    // 提示：未知状态也给个兜底
    t('results.status_completed'))

  const getStatusTagColor = (s: string) =>
    (({ completed: 'success', in_progress: 'warning', not_started: 'default' } as const)[s as keyof any] || 'success')

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
      <div>
        <Title level={2}>{t('results.title')}</Title>
        <Text type="secondary">{t('results.description')}</Text>
      </div>

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

      <Row gutter={[16, 16]}>
        {items.map(item => (
          <Col key={item.id} xs={24} md={12} lg={8}>
            <ResultCard
              result={item as any}
              statusLabel={getStatusLabel}
              statusTagColor={getStatusTagColor}
              locale={language === 'zh-CN' ? 'zh-CN' : 'en-US'}
            />
          </Col>
        ))}
      </Row>

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
