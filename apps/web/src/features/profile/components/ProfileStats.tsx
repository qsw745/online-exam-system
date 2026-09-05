import { Alert, Button, Card, Statistic, Spin } from 'antd'
import { useEffect, useState } from 'react'
import { wrongQuestions } from '@/shared/api/http'

export default function ProfileStats({ t }: { t: (key: string) => string }) {
  const [stats, setStats] = useState<{ totalPractice: number; correctRate: number; masteredQuestions: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setError(null)
      await wrongQuestions.getPracticeStats().then(result => {
      if (!active) return
      if (!result.success || !result.data) throw new Error(('error' in result ? result.error : '') || '学习统计加载失败')
      const data = result.data as Record<string, unknown>
      const values = [data.totalPractice, data.correctRate, data.masteredQuestions].map(Number)
      if (values.some(value => !Number.isFinite(value) || value < 0)) throw new Error('学习统计数据不完整')
      setStats({ totalPractice: values[0], correctRate: Math.min(100, values[1]), masteredQuestions: values[2] })
    }).catch(error => { if (active) setError(error instanceof Error ? error.message : '学习统计加载失败') })
      .finally(() => { if (active) setLoading(false) })
    }
    void load()
    return () => { active = false }
  }, [retry])
  return <Card title="学习统计" className="student-profile-stats">
    {error ? <Alert type="warning" message={error} action={<Button onClick={() => setRetry(value => value + 1)}>{t('app.retry')}</Button>} /> :
      <Spin spinning={loading}><div className="student-profile-stats__grid">
        <Statistic title="累计练习次数" value={stats?.totalPractice ?? '—'} />
        <Statistic title="练习正确率" value={stats?.correctRate ?? '—'} suffix={stats ? '%' : undefined} precision={stats ? 1 : undefined} />
        <Statistic title="已掌握题目" value={stats?.masteredQuestions ?? '—'} />
      </div></Spin>}
  </Card>
}
