import { Card, Col, Row, Statistic } from 'antd'
import { Users, TrendingUp, BookOpen, Award, Target, PieChart } from 'lucide-react'
import React from 'react'
import type { Overview } from '../types'

export const OverviewStats: React.FC<{ overview: Overview }> = ({ overview }) => {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} lg={4}>
        <Card>
          <Statistic
            title="总学生数"
            value={overview?.total_students || 0}
            prefix={<Users className="w-4 h-4 text-blue-500" />}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={4}>
        <Card>
          <Statistic
            title="活跃学生"
            value={overview?.active_students || 0}
            prefix={<TrendingUp className="w-4 h-4 text-green-500" />}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={4}>
        <Card>
          <Statistic
            title="总题目数"
            value={overview?.total_questions || 0}
            prefix={<BookOpen className="w-4 h-4 text-purple-500" />}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={4}>
        <Card>
          <Statistic
            title="总考试数"
            value={overview?.total_exams || 0}
            prefix={<Award className="w-4 h-4 text-orange-500" />}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={4}>
        <Card>
          <Statistic
            title="平均分"
            value={overview?.avg_score || 0}
            precision={1}
            prefix={<Target className="w-4 h-4 text-red-500" />}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={4}>
        <Card>
          <Statistic
            title="完成率"
            value={overview?.completion_rate || 0}
            precision={1}
            suffix="%"
            prefix={<PieChart className="w-4 h-4 text-cyan-500" />}
          />
        </Card>
      </Col>
    </Row>
  )
}
