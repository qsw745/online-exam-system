import { Card, Col, Row, Statistic } from 'antd'
import { Users, TrendingUp, BookOpen, Award, Target, PieChart } from 'lucide-react'
import React from 'react'
import { useLanguage } from '@/shared/contexts/LanguageContext'

type Overview = {
  total_students: number
  active_students: number
  total_questions: number
  total_exams: number
  avg_score: number
  completion_rate: number
}

export const OverviewStats: React.FC<{ overview: Overview }> = ({ overview }) => {
  const { t } = useLanguage()
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} lg={4}>
        <Card>
          <Statistic
            title={t('analytics.total_students')}
            value={overview?.total_students || 0}
            prefix={<Users className="w-4 h-4 text-blue-500" />}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={4}>
        <Card>
          <Statistic
            title={t('analytics.active_students')}
            value={overview?.active_students || 0}
            prefix={<TrendingUp className="w-4 h-4 text-green-500" />}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={4}>
        <Card>
          <Statistic
            title={t('analytics.total_questions')}
            value={overview?.total_questions || 0}
            prefix={<BookOpen className="w-4 h-4 text-purple-500" />}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={4}>
        <Card>
          <Statistic
            title={t('analytics.total_exams')}
            value={overview?.total_exams || 0}
            prefix={<Award className="w-4 h-4 text-orange-500" />}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={4}>
        <Card>
          <Statistic
            title={t('analytics.avg_score')}
            value={overview?.avg_score || 0}
            precision={1}
            prefix={<Target className="w-4 h-4 text-red-500" />}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={4}>
        <Card>
          <Statistic
            title={t('analytics.completion_rate')}
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
