
import { useLearningProgress } from '@/shared/hooks/useLearningProgress'
import { Alert, Button, Col, Row, Space, Spin, Typography } from 'antd'
import { TrendingUp } from 'lucide-react'
import LearningFilters from '../components/LearningFilters'
import LearningOverview from '../components/LearningOverview'
import LearningStatsCards from '../components/LearningStatsCards'
import LearningTimeline from '../components/LearningTimeline'
import { translate } from '@/shared/utils/i18n'
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
    loading, error, subjectsError, retry,
  } = useLearningProgress()

  return (
    <div className="student-learning-progress">
 
      <div className="student-page-header" style={{ marginBottom: 16 }}>
        <Space>
          <TrendingUp style={{ width: 24, height: 24, color: '#1890ff' }} />
          <Title level={2} style={{ margin: 0 }}>
            {translate('menus.learning-progress')}</Title>
        </Space>
        <LearningFilters
          subject={subject}
          onSubjectChange={setSubject}
          subjects={subjects}
          timeRange={timeRange}
          onRangeChange={setTimeRange}
        />
      </div>

      {subjectsError && <Alert type="warning" showIcon message={subjectsError} action={<Button onClick={retry}>重试</Button>} style={{ marginBottom: 16 }} />}
      {error && <Alert type="error" showIcon message="学习进度暂时无法显示" description={error} action={<Button onClick={retry}>重试</Button>} />}
      {loading && <div style={{ minHeight: 240, display: 'grid', placeItems: 'center' }}><Spin /></div>}
      {!loading && !error && stats && <>
        <LearningStatsCards stats={stats} />
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={16}>
            <LearningOverview stats={stats} />
          </Col>
          <Col xs={24} lg={8}>
            <LearningTimeline records={records} />
          </Col>
        </Row>
      </>}
    </div>
  )
}
