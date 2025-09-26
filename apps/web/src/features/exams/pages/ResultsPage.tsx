import AppBreadcrumb from '@/shared/components/AppBreadcrumb'
import { createPaginationConfig } from '@/shared/constants/pagination'
import { useAuth } from '@/shared/contexts/AuthContext'
import { useLanguage } from '@/shared/contexts/LanguageContext'
import { Card, Col, Empty, Pagination, Row, Space, Spin, Typography } from 'antd'
import { BookmarkPlus } from 'lucide-react'
import ResultCard, { type UiStatus } from '../components/ResultCard'
import ResultsFilters from '../components/ResultsFilters'
import useResults from '../hooks/useResults'
const { Title, Text } = Typography

export default function ResultsPage() {
  useAuth()
  const { t, language } = useLanguage()
  const { loading, items, page, limit, total, searchTerm, status, setPage, onSearch, onStatusChange } = useResults(12)

  const STATUS_LABELS = {
    completed: t('results.status_completed'),
    in_progress: t('results.status_in_progress'),
    not_started: t('results.status_not_started'),
  } as const
  const STATUS_COLORS = { completed: 'success', in_progress: 'warning', not_started: 'default' } as const

  const getStatusLabel = (s: UiStatus) => STATUS_LABELS[s]
  const getStatusTagColor = (s: UiStatus) => STATUS_COLORS[s]

  const toUi = (s: string): UiStatus => (s === 'submitted' || s === 'graded' ? 'completed' : (s as UiStatus))
  const statusForFilter: UiStatus | 'all' = status === 'all' ? 'all' : toUi(status as string)
  const handleFilterStatusChange = (val: UiStatus | 'all') => {
    if (val === 'all') return onStatusChange('all')
    if (val === 'completed') return onStatusChange('submitted' as any)
    return onStatusChange(val as any)
  }

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
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <AppBreadcrumb />
      <div>
        <Title level={2}>{t('results.title')}</Title>
        <Text type="secondary">{t('results.description')}</Text>
      </div>

      <ResultsFilters
        search={searchTerm}
        status={statusForFilter}
        onSearchChange={onSearch}
        onStatusChange={handleFilterStatusChange}
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
              result={item}
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
