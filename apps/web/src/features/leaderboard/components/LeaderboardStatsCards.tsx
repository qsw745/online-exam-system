import { Card, Col, Row, Statistic } from 'antd'
import { Award, Target, TrendingUp, Users } from 'lucide-react'
import type { LeaderboardStats } from '@shared/api/endpoints/leaderboard'

export default function LeaderboardStatsCards({ stats }: { stats: LeaderboardStats | null }) {
  return (
    <Row gutter={[16, 16]} className="mb-6">
      <Col xs={24} sm={6}>
        <Card>
          <Statistic
            title="参与人数"
            value={stats?.total_participants || 0}
            prefix={<Users className="w-4 h-4 text-blue-500" />}
          />
        </Card>
      </Col>
      <Col xs={24} sm={6}>
        <Card>
          <Statistic
            title="平均分数"
            value={stats?.avg_score || 0}
            precision={1}
            prefix={<Target className="w-4 h-4 text-green-500" />}
          />
        </Card>
      </Col>
      <Col xs={24} sm={6}>
        <Card>
          <Statistic
            title="最高分数"
            value={stats?.top_score || 0}
            precision={1}
            prefix={<TrendingUp className="w-4 h-4 text-orange-500" />}
          />
        </Card>
      </Col>
      <Col xs={24} sm={6}>
        <Card>
          <Statistic
            title="我的排名"
            value={stats?.my_rank ?? '-'}
            prefix={<Award className="w-4 h-4 text-purple-500" />}
          />
        </Card>
      </Col>
    </Row>
  )
}
