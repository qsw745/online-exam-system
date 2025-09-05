// features/wrong-questions/components/StatsCards.tsx
import { Card, Space, Typography } from 'antd'
import { BookOpen, CheckCircle, TrendingUp, XCircle } from 'lucide-react'
const { Title, Text } = Typography

export const StatsCards: React.FC<{
  stats: {
    totalPractice: number
    correctRate: string
    wrongQuestions: number
    masteredQuestions: number
  }
}> = ({ stats }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Space direction="vertical" size={0}>
          <Text type="secondary">总练习次数</Text>
          <Title level={2} style={{ margin: 0 }}>
            {stats.totalPractice}
          </Title>
        </Space>
        <BookOpen style={{ width: 32, height: 32, color: '#1890ff' }} />
      </div>
    </Card>
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Space direction="vertical" size={0}>
          <Text type="secondary">正确率</Text>
          <Title level={2} style={{ margin: 0, color: '#52c41a' }}>
            {stats.correctRate}%
          </Title>
        </Space>
        <TrendingUp style={{ width: 32, height: 32, color: '#52c41a' }} />
      </div>
    </Card>
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Space direction="vertical" size={0}>
          <Text type="secondary">错题数量</Text>
          <Title level={2} style={{ margin: 0, color: '#ff4d4f' }}>
            {stats.wrongQuestions}
          </Title>
        </Space>
        <XCircle style={{ width: 32, height: 32, color: '#ff4d4f' }} />
      </div>
    </Card>
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Space direction="vertical" size={0}>
          <Text type="secondary">已掌握</Text>
          <Title level={2} style={{ margin: 0, color: '#1890ff' }}>
            {stats.masteredQuestions}
          </Title>
        </Space>
        <CheckCircle style={{ width: 32, height: 32, color: '#1890ff' }} />
      </div>
    </Card>
  </div>
)
