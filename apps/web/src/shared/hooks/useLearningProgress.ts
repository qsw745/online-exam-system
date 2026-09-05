import { useEffect, useState } from 'react'
import dayjs, { Dayjs } from 'dayjs'
import { learningProgressApi, type LearningStats, type ProgressRecord, type LearningSubject } from '@/shared/api/endpoints/learningProgress'

export function useLearningProgress() {
  const [timeRange, setTimeRange] = useState<[Dayjs | null, Dayjs | null]>([dayjs().subtract(30, 'day'), dayjs()])
  const [subject, setSubject] = useState('all')
  const [subjects, setSubjects] = useState<LearningSubject[]>([])
  const [stats, setStats] = useState<LearningStats | null>(null)
  const [records, setRecords] = useState<ProgressRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [subjectsError, setSubjectsError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    setSubjectsError(null)
    void learningProgressApi.getSubjects().then(list => { if (active) setSubjects(list) })
      .catch(error => { if (active) setSubjectsError(error instanceof Error ? error.message : '科目加载失败') })
    return () => { active = false }
  }, [retry])
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    setStats(null)
    setRecords([])
    const filters = { start: timeRange[0], end: timeRange[1], subject }
    void Promise.all([learningProgressApi.getStats(filters), learningProgressApi.getRecords({ ...filters, limit: 20 })])
      .then(([stats, records]) => { if (active) { setStats(stats); setRecords(records) } })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : '学习进度加载失败') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [subject, timeRange, retry])
  const namedRecords = records.map(record => ({ ...record,
    subject: subjects.find(subject => subject.id === record.subject)?.name ?? (/^\d+$/.test(record.subject) ? `科目 ${record.subject}` : record.subject) }))
  return { timeRange, setTimeRange, subject, setSubject, subjects, stats, records: namedRecords, loading, error, subjectsError,
    retry: () => setRetry(value => value + 1) }
}
export default useLearningProgress
