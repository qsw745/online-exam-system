import React from 'react'
import { Space, Typography, Row, Col, message } from 'antd'
import LoadingSpinner from '@shared/components/LoadingSpinner'
import { useLanguage } from '@shared/contexts/LanguageContext'
import { useDashboard } from '@shared/hooks/useDashboard'
import { DashboardStatsCards } from '../components/DashboardStatsCards'
import { RecentTasksList } from '../components/RecentTasksList'
import { RecentResultsList } from '../components/RecentResultsList'

const { Title, Text } = Typography

const DashboardPage: React.FC = () => {
  const { t, language } = useLanguage()
  const locale = (language === 'zh-CN' ? 'zh-CN' : 'en-US') as 'zh-CN' | 'en-US'

  const { stats, recentTasks, recentResults, isLoading, isError, errorMessages } = useDashboard(5)

  if (isError && errorMessages.length) {
    // 只提示一次
    message.error(errorMessages[0])
  }

  if (isLoading) {
    return <LoadingSpinner text={t('dashboard.loading')} />
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* 页面标题 */}
      <div>
        <Title level={2} style={{ marginBottom: 8 }}>
          {t('dashboard.title')}
        </Title>
        <Text type="secondary">{t('dashboard.description')}</Text>
      </div>

      {/* 统计卡片 */}
      <DashboardStatsCards
        stats={stats}
        labels={{
          total: t('dashboard.total_tasks'),
          completed: t('dashboard.completed_tasks'),
          average: t('dashboard.average_score'),
          best: t('dashboard.best_score'),
        }}
      />

      {/* 最近任务 & 最近成绩 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <RecentTasksList
            title={t('dashboard.recent_tasks')}
            viewAllText={t('dashboard.view_all')}
            emptyText={t('dashboard.no_tasks')}
            tasks={recentTasks}
            locale={locale}
            label={{
              start: t('dashboard.start_time'),
              exam: t('dashboard.exam'),
              practice: t('dashboard.practice'),
            }}
          />
        </Col>
        <Col xs={24} lg={12}>
          <RecentResultsList
            title={t('dashboard.recent_results')}
            viewAllText={t('dashboard.view_all')}
            emptyText={t('dashboard.no_results')}
            results={recentResults}
            locale={locale}
            label={{ submit: t('dashboard.submit_time'), score: t('dashboard.score') }}
          />
        </Col>
      </Row>
    </Space>
  )
}

export default DashboardPage
