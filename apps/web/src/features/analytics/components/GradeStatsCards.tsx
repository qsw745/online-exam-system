// apps/web/src/features/analytics/components/GradeStatsCards.tsx
import React from 'react'
import { Card, Col, Row, Statistic } from 'antd'
import { CalendarOutlined, LineChartOutlined, TrophyOutlined, TeamOutlined } from '@ant-design/icons'
import type { GradeStats } from '@/shared/types/grades'
import { translate } from '@/shared/utils/i18n'

export const GradeStatsCards: React.FC<{ stats: GradeStats }> = ({ stats }) => {
  return (
    <Row gutter={[12, 12]}>
      <Col xs={24} md={6}>
        <Card>
          <Statistic title={translate('auto.5b6dc0eaab')} value={stats.totalStudents} prefix={<TeamOutlined />} />
        </Card>
      </Col>
      <Col xs={24} md={6}>
        <Card>
          <Statistic title={translate('auto.2d8e9a603f')} value={stats.totalExams} prefix={<TrophyOutlined />} />
        </Card>
      </Col>
      <Col xs={24} md={6}>
        <Card>
          <Statistic
            title={translate('profile.average_score')}
            value={Number(stats.averageScore || 0)}
            precision={1}
            prefix={<LineChartOutlined />}
          />
        </Card>
      </Col>
      <Col xs={24} md={6}>
        <Card>
          <Statistic
            title={translate('auto.b67b7c3557')}
            value={Number(stats.passRate || 0)}
            precision={1}
            suffix="%"
            prefix={<CalendarOutlined />}
          />
        </Card>
      </Col>
    </Row>
  )
}
