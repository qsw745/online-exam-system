import { Card, Timeline, Typography } from 'antd'
import dayjs from 'dayjs'
import type { ProgressRecord } from '@shared/api/endpoints/learningProgress'
import { Calendar } from 'lucide-react'
const { Text } = Typography

const color = (v: number) => (v >= 80 ? '#52c41a' : v >= 60 ? '#faad14' : '#ff4d4f')
const fmt = (minutes: number) => {
  const m = Math.max(0, Math.floor(Number(minutes) || 0))
  const h = Math.floor(m / 60),
    left = m % 60
  return h > 0 ? `${h}小时${left}分钟` : `${left}分钟`
}

export default function LearningTimeline({ records }: { records: ProgressRecord[] }) {
  return (
    <Card title="最近学习记录" style={{ height: '100%' }}>
      {records.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <Calendar style={{ width: 48, height: 48, color: '#d9d9d9', margin: '0 auto 8px' }} />
          <Text type="secondary">暂无学习记录</Text>
        </div>
      ) : (
        <Timeline
          items={records.map(r => {
            const rate = r.questions_count ? (r.correct_count / r.questions_count) * 100 : 0
            return {
              key: r.id,
              color: color(rate),
              children: (
                <div>
                  <Text strong>{r.subject}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 14 }}>
                    {r.questions_count}题 · 正确率{rate.toFixed(1)}%
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 14 }}>
                    学习时长: {fmt(r.study_time)}
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {dayjs(r.created_at).format('MM-DD HH:mm')}
                  </Text>
                </div>
              ),
            }
          })}
        />
      )}
    </Card>
  )
}
