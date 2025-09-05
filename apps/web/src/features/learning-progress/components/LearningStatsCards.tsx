import { Card, Col, Row, Statistic } from 'antd'
import { BookOpen, Target, Clock, Award } from 'lucide-react'
import type { LearningStats } from '@shared/api/endpoints/learningProgress'

const fmt = (minutes: number) => {
  const m = Math.max(0, Math.floor(Number(minutes) || 0))
  const h = Math.floor(m / 60),
    left = m % 60
  return h > 0 ? `${h}小时${left}分钟` : `${left}分钟`
}

export default function LearningStatsCards({ stats }: { stats: LearningStats | null }) {
  const correctRate = Number(stats?.correct_rate ?? 0)
  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title="总学习时长"
            value={stats?.total_study_time || 0}
            formatter={v => fmt(Number(v))}
            prefix={<Clock className="w-4 h-4 text-blue-500" />}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title="练习题目数"
            value={stats?.questions_practiced || 0}
            prefix={<BookOpen className="w-4 h-4 text-green-500" />}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title="正确率"
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
            title="连续学习天数"
            value={stats?.streak_days || 0}
            suffix="天"
            prefix={<Award className="w-4 h-4 text-purple-500" />}
          />
        </Card>
      </Col>
    </Row>
  )
}
