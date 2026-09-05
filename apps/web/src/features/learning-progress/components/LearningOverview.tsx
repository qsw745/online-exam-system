import { Card, Progress, Space, Typography } from 'antd'
import type { LearningStats } from '@/shared/api/endpoints/learningProgress'
import { translate } from '@/shared/utils/i18n'
const { Title, Text } = Typography

const color = (v: number) => (v >= 80 ? '#52c41a' : v >= 60 ? '#faad14' : '#ff4d4f')

export default function LearningOverview({ stats }: { stats: LearningStats | null }) {
  const correctRate = Number(stats?.correct_rate ?? 0)
  return (
    <Card title={translate('auto.c508a25f3d')} style={{ height: '100%' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
            <Text>{translate('auto.8dc159502e')}</Text>
            <Text strong>{correctRate.toFixed(1)}%</Text>
          </div>
          <Progress percent={correctRate} strokeColor={color(correctRate)} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <Text>累计答对</Text><Text strong>{stats?.correct_answers ?? 0} 题</Text>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24 }}>
          <Card size="small" style={{ textAlign: 'center', background: 'var(--practice-selected-bg)' }}>
            <Title level={2} style={{ margin: 0, color: '#1890ff' }}>
              {stats?.subjects_studied || 0}
            </Title>
            <Text type="secondary">{translate('auto.87bd8742fe')}</Text>
          </Card>
          <Card size="small" style={{ textAlign: 'center', background: 'var(--practice-correct-bg)' }}>
            <Title level={2} style={{ margin: 0, color: '#52c41a' }}>
              {Math.round((stats?.total_study_time || 0) / 60 * 100) / 100}
            </Title>
            <Text type="secondary">{translate('auto.4a6ffaf41e')}</Text>
          </Card>
        </div>
      </Space>
    </Card>
  )
}
