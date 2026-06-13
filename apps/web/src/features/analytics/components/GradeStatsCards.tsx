// apps/web/src/features/analytics/components/GradeStatsCards.tsx
import React from 'react'
import { Card, Col, Row, Statistic } from 'antd'
import { CalendarOutlined, LineChartOutlined, TrophyOutlined, TeamOutlined } from '@ant-design/icons'
import type { GradeStats } from '@/shared/types/grades'

export const GradeStatsCards: React.FC<{ stats: GradeStats }> = ({ stats }) => {
  return (
    <Row gutter={[12, 12]}>
      <Col xs={24} md={6}>
        <Card>
          <Statistic title="参与学生" value={stats.totalStudents} prefix={<TeamOutlined />} />
        </Card>
      </Col>
      <Col xs={24} md={6}>
        <Card>
          <Statistic title="考试总数" value={stats.totalExams} prefix={<TrophyOutlined />} />
        </Card>
      </Col>
      <Col xs={24} md={6}>
        <Card>
          <Statistic
            title="平均分"
            value={Number(stats.averageScore || 0)}
            precision={1}
            prefix={<LineChartOutlined />}
          />
        </Card>
      </Col>
      <Col xs={24} md={6}>
        <Card>
          <Statistic
            title="及格率"
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
