import { Card, Typography } from 'antd'
import { ArrowRight, BookOpenCheck, ChartNoAxesColumnIncreasing, Heart, RotateCcw } from 'lucide-react'
import { Link } from 'react-router-dom'

const { Title, Text } = Typography

const learningEntries = [
  {
    to: '/learning/practice',
    title: '题目练习',
    description: '按知识点练习，及时巩固。',
    icon: BookOpenCheck,
  },
  {
    to: '/learning/wrong-questions',
    title: '错题本',
    description: '集中处理尚未掌握的题目。',
    icon: RotateCcw,
  },
  {
    to: '/learning/favorites',
    title: '我的收藏',
    description: '回看重要题目和学习资料。',
    icon: Heart,
  },
  {
    to: '/learning/progress',
    title: '学习进度',
    description: '查看完成情况和薄弱方向。',
    icon: ChartNoAxesColumnIncreasing,
  },
]

export default function StudentLearningHubPage() {
  return (
    <section aria-labelledby="student-learning-title">
      <Title id="student-learning-title" level={2} style={{ marginTop: 0 }}>
        学习
      </Title>
      <Text type="secondary">从练习、错题和进度中找到下一步。</Text>
      <div className="student-learning-grid" style={{ marginTop: 20 }}>
        {learningEntries.map(({ to, title, description, icon: Icon }) => (
          <Link key={to} to={to} aria-label={title} style={{ textDecoration: 'none' }}>
            <Card hoverable style={{ height: '100%' }}>
              <Icon size={24} color="#18A77B" aria-hidden="true" />
              <Title level={4} style={{ margin: '14px 0 6px' }}>
                {title}
              </Title>
              <Text type="secondary">{description}</Text>
              <ArrowRight size={18} aria-hidden="true" style={{ float: 'right', marginTop: 18 }} />
            </Card>
          </Link>
        ))}
      </div>
    </section>
  )
}
