// src/features/dashboard/pages/DashboardPage.tsx
import React, { useEffect } from 'react'
import { Space, Typography, Row, Col, message } from 'antd'
import LoadingSpinner from '@/shared/components/LoadingSpinner'
import { useLanguage } from '@/shared/contexts/LanguageContext'
import { useDashboard } from '@/shared/hooks/useDashboard'
import { DashboardStatsCards } from '../components/DashboardStatsCards'
import { RecentTasksList } from '../components/RecentTasksList'
import { RecentResultsList } from '../components/RecentResultsList'

const { Title, Text } = Typography

const DashboardPage: React.FC = () => {
  const { t, language } = useLanguage()
  const locale = (language === 'zh-CN' ? 'zh-CN' : 'en-US') as 'zh-CN' | 'en-US'

  const { stats, recentTasks, recentResults, isLoading, isError, errorMessages } = useDashboard(5)

  useEffect(() => {
    if (isError && errorMessages.length) message.error(errorMessages[0])
  }, [isError, errorMessages])

//   if (isLoading) {
//     // 整页居中，显式传入文案
//     return <LoadingSpinner center="page" text={t('dashboard.loading')} />
//   }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={2} style={{ marginBottom: 8 }}>
          {t('dashboard.title')}
        </Title>
        <Text type="secondary">{t('dashboard.description')}</Text>
      </div>

      <DashboardStatsCards
        stats={stats}
        labels={{
          total: t('dashboard.total_tasks'),
          completed: t('dashboard.completed_tasks'),
          average: t('dashboard.average_score'),
          best: t('dashboard.best_score'),
        }}
      />

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
