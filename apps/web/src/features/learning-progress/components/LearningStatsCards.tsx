import { Card, Col, Row, Statistic } from 'antd'
import { BookOpen, Target, Clock, Award } from 'lucide-react'
import type { LearningStats } from '@/shared/api/endpoints/learningProgress'
import { translate } from '@/shared/utils/i18n'

const fmt = (minutes: number) => {
  const m = Math.max(0, Math.floor(Number(minutes) || 0))
  const h = Math.floor(m / 60),
    left = m % 60
  return h > 0
    ? `${h}${translate('time.hour')}${left}${translate('time.minute')}`
    : `${left}${translate('time.minute')}`
}

export default function LearningStatsCards({ stats }: { stats: LearningStats | null }) {
  const correctRate = Number(stats?.correct_rate ?? 0)
  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title={translate('auto.8670d9e44f')}
            value={stats?.total_study_time || 0}
            formatter={v => fmt(Number(v))}
            prefix={<Clock className="w-4 h-4 text-blue-500" />}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title={translate('auto.430f401c3f')}
            value={stats?.questions_practiced || 0}
            prefix={<BookOpen className="w-4 h-4 text-green-500" />}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title={translate('auto.8dc159502e')}
            value={correctRate}
            precision={1}
            suffix="%"
            prefix={<Target className="w-4 h-4 text-orange-500" />}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title={translate('auto.f36ae23535')}
            value={stats?.streak_days || 0}
            suffix={translate('visible.c3304d1e49')}
            prefix={<Award className="w-4 h-4 text-purple-500" />}
          />
        </Card>
      </Col>
    </Row>
  )
}
