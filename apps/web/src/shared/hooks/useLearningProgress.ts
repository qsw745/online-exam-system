import { useCallback, useEffect, useState } from 'react'
import dayjs, { Dayjs } from 'dayjs'
import { App } from 'antd'
import { learningProgressApi, type LearningStats, type ProgressRecord } from '@/shared/api/endpoints/learningProgress'
import { translate } from '@/shared/utils/i18n'

export function useLearningProgress() {
  const { message } = App.useApp()

  // 筛选
  const [timeRange, setTimeRange] = useState<[Dayjs | null, Dayjs | null]>([dayjs().subtract(30, 'day'), dayjs()])
  const [subject, setSubject] = useState('all')
  const [subjects, setSubjects] = useState<string[]>([])

  // 数据
  const [stats, setStats] = useState<LearningStats | null>(null)
  const [records, setRecords] = useState<ProgressRecord[]>([])
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true)
      const s = await learningProgressApi.getStats({ start: timeRange[0], end: timeRange[1], subject })
      setStats(s)
    } catch {
      message.error(translate('auto.e56cc2ab1f'))
      setStats({
        total_study_time: 0,
        questions_practiced: 0,
        correct_rate: 0,
        streak_days: 0,
        subjects_studied: 0,
        avg_score: 0,
      })
    } finally {
      setLoading(false)
    }
  }, [subject, timeRange, message])

  const fetchRecords = useCallback(async () => {
    try {
      const list = await learningProgressApi.getRecords({
        start: timeRange[0],
        end: timeRange[1],
        subject,
        limit: 20,
      })
      setRecords(list)
    } catch {
      message.error(translate('auto.d1c8904ecf'))
      setRecords([])
    }
  }, [subject, timeRange, message])

  const fetchSubjects = useCallback(async () => {
    try {
      const list = await learningProgressApi.getSubjects()
      setSubjects(list)
    } catch {
      /* 静默 */
    }
  }, [])

  // 初始化 & 依赖变更
  useEffect(() => {
    fetchSubjects()
  }, [fetchSubjects])
  useEffect(() => {
    fetchStats()
    fetchRecords()
  }, [fetchStats, fetchRecords])

  return {
    // state
    timeRange,
    setTimeRange,
    subject,
    setSubject,
    subjects,
    stats,
    records,
    loading,
  }
}

export default useLearningProgress
