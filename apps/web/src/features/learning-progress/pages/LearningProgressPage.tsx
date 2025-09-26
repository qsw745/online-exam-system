import AppBreadcrumb from '@/shared/components/AppBreadcrumb'
import { useLearningProgress } from '@/shared/hooks/useLearningProgress'
import { Col, Row, Space, Spin, Typography } from 'antd'
import { TrendingUp } from 'lucide-react'
import LearningFilters from '../components/LearningFilters'
import LearningOverview from '../components/LearningOverview'
import LearningStatsCards from '../components/LearningStatsCards'
import LearningTimeline from '../components/LearningTimeline'
const { Title } = Typography

export default function LearningProgressPage() {
  const {
    // filters
    subject,
    setSubject,
    subjects,
    timeRange,
    setTimeRange,
    // data
    stats,
    records,
    loading,
  } = useLearningProgress()

  return (
    <div >
      <AppBreadcrumb />
      <div className="flex items-center justify-between mb-6">
        <Space>
          <TrendingUp style={{ width: 24, height: 24, color: '#1890ff' }} />
          <Title level={2} style={{ margin: 0 }}>
            学习进度
          </Title>
        </Space>
        <LearningFilters
          subject={subject}
          onSubjectChange={setSubject}
          subjects={subjects}
          timeRange={timeRange}
          onRangeChange={setTimeRange}
        />
      </div>

      <Spin spinning={loading}>
        <LearningStatsCards stats={stats} />
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={16}>
            <LearningOverview stats={stats} />
          </Col>
          <Col xs={24} lg={8}>
            <LearningTimeline records={records} />
          </Col>
        </Row>
      </Spin>
    </div>
  )
}
