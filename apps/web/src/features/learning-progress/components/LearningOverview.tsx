import { Card, Progress, Space, Typography } from 'antd'
import type { LearningStats } from '@/shared/api/endpoints/learningProgress'
import { translate } from '@/shared/utils/i18n'
const { Title, Text } = Typography

const color = (v: number) => (v >= 80 ? '#52c41a' : v >= 60 ? '#faad14' : '#ff4d4f')

export default function LearningOverview({ stats }: { stats: LearningStats | null }) {
  const correctRate = Number(stats?.correct_rate ?? 0)
  const avgScore = Number(stats?.avg_score ?? 0)
  return (
    <Card title={translate('auto.c508a25f3d')} style={{ height: '100%' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <div className="flex items-center justify-between mb-2">
            <Text>{translate('auto.d9bdfbdaf9')}</Text>
            <Text strong>{correctRate.toFixed(1)}%</Text>
          </div>
          <Progress percent={correctRate} strokeColor={color(correctRate)} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <Text>{translate('dashboard.average_score')}</Text>
            <Text strong>{avgScore.toFixed(1)}{translate('papers.addon_score')}</Text>
          </div>
          <Progress percent={avgScore} strokeColor={color(avgScore)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24 }}>
          <Card size="small" style={{ textAlign: 'center', background: '#f0f8ff' }}>
            <Title level={2} style={{ margin: 0, color: '#1890ff' }}>
              {stats?.subjects_studied || 0}
            </Title>
            <Text type="secondary">{translate('auto.87bd8742fe')}</Text>
          </Card>
          <Card size="small" style={{ textAlign: 'center', background: '#f6ffed' }}>
            <Title level={2} style={{ margin: 0, color: '#52c41a' }}>
              {Math.round((stats?.total_study_time || 0) / 60)}
            </Title>
            <Text type="secondary">{translate('auto.4a6ffaf41e')}</Text>
          </Card>
        </div>
      </Space>
    </Card>
  )
}
