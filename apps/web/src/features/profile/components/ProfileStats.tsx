// features/profile/components/ProfileStats.tsx
import { Card, Typography, Space } from 'antd'
import { Calendar, School, Trophy } from 'lucide-react'
const { Title, Text } = Typography

export default function ProfileStats({ t }: { t: (k: string) => string }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}
    >
      <Card size="small">
        <Space align="center" style={{ marginBottom: 8 }}>
          <Trophy style={{ width: 20, height: 20, color: '#1890ff' }} />
          <Text strong>{t('profile.exam_score')}</Text>
        </Space>
        <div>
          <Title level={2} style={{ margin: 0, fontSize: 32 }}>
            85.5
          </Title>
          <Text type="secondary">{t('profile.average_score')}</Text>
        </div>
      </Card>

      <Card size="small">
        <Space align="center" style={{ marginBottom: 8 }}>
          <Calendar style={{ width: 20, height: 20, color: '#1890ff' }} />
          <Text strong>{t('profile.exams_taken')}</Text>
        </Space>
        <div>
          <Title level={2} style={{ margin: 0, fontSize: 32 }}>
            12
          </Title>
          <Text type="secondary">{t('profile.total_exams')}</Text>
        </div>
      </Card>

      <Card size="small">
        <Space align="center" style={{ marginBottom: 8 }}>
          <School style={{ width: 20, height: 20, color: '#1890ff' }} />
          <Text strong>{t('profile.knowledge_points')}</Text>
        </Space>
        <div>
          <Title level={2} style={{ margin: 0, fontSize: 32 }}>
            156
          </Title>
          <Text type="secondary">{t('profile.mastered')}</Text>
        </div>
      </Card>
    </div>
  )
}
