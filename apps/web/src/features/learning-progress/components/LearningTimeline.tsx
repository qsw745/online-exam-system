import { Card, Timeline, Typography } from 'antd'
import dayjs from '@/shared/utils/dayjs'
import type { ProgressRecord } from '@/shared/api/endpoints/learningProgress'
import { Calendar } from 'lucide-react'
import { translate } from '@/shared/utils/i18n'
import { formatDateTime } from '@/shared/utils/datetime'
const { Text } = Typography

const color = (v: number) => (v >= 80 ? '#52c41a' : v >= 60 ? '#faad14' : '#ff4d4f')
const fmt = (minutes: number) => {
  const m = Math.max(0, Math.floor(Number(minutes) || 0))
  const h = Math.floor(m / 60),
    left = m % 60
  return h > 0
    ? `${h}${translate('time.hour')}${left}${translate('time.minute')}`
    : `${left}${translate('time.minute')}`
}

export default function LearningTimeline({ records }: { records: ProgressRecord[] }) {
  return (
    <Card title={translate('auto.ab8204cf63')} style={{ height: '100%' }}>
      {records.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <Calendar style={{ width: 48, height: 48, color: '#d9d9d9', margin: '0 auto 8px' }} />
          <Text type="secondary">{translate('auto.95cb38d0ec')}</Text>
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
                    {r.questions_count}{translate('auto.9ba3e280c2')}{rate.toFixed(1)}%
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 14 }}>
                    {translate('auto.d31eca4d5b')}{fmt(r.study_time)}
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {formatDateTime(r.created_at)}
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
