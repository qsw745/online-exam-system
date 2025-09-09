import { Card, Col, Row, Statistic } from 'antd'
import { FileText, Clock, TrendingUp, Trophy } from 'lucide-react'
import React from 'react'
import type { Stats } from '@/shared/api/http'

export const DashboardStatsCards: React.FC<{
  stats: Stats
  labels: {
    total: string
    completed: string
    average: string
    best: string
  }
}> = ({ stats, labels }) => {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title={labels.total}
            value={stats.total_tasks}
            prefix={<FileText style={{ color: '#1890ff' }} />}
            valueStyle={{ color: '#1890ff' }}
          />
        </Card>
      </Col>

      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title={labels.completed}
            value={stats.completed_tasks}
            prefix={<Clock style={{ color: '#52c41a' }} />}
            valueStyle={{ color: '#52c41a' }}
          />
        </Card>
      </Col>

      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title={labels.average}
            value={stats.average_score}
            precision={1}
            prefix={<TrendingUp style={{ color: '#faad14' }} />}
            valueStyle={{ color: '#faad14' }}
          />
        </Card>
      </Col>

      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title={labels.best}
            value={stats.best_score}
            prefix={<Trophy style={{ color: '#f5222d' }} />}
            valueStyle={{ color: '#f5222d' }}
          />
        </Card>
      </Col>
    </Row>
  )
}
