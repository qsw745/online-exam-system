import React, { useState, useEffect } from 'react'
import { Card, Row, Col, Progress, Statistic, Timeline, Select, DatePicker, Spin, App, Space, Typography } from 'antd'
import { TrendingUp, BookOpen, Target, Clock, Award, Calendar } from 'lucide-react'
import { api } from '@shared/api/http'
import dayjs, { Dayjs } from 'dayjs'

const { RangePicker } = DatePicker
const { Option } = Select
const { Title, Text } = Typography

// ===== 统一 ApiResult 类型与守卫（兼容你项目的 http 封装）=====
type ApiSuccess<T = any> = { success: true; data: T; message?: string }
type ApiFailure = { success: false; error?: string; message?: string }
type ApiResult<T = any> = ApiSuccess<T> | ApiFailure
const isSuccess = <T,>(r: any): r is ApiSuccess<T> => r && typeof r === 'object' && r.success === true
// ===========================================================

interface LearningStats {
  total_study_time: number
  questions_practiced: number
  correct_rate: number
  streak_days: number
  subjects_studied: number
  avg_score: number
}

interface ProgressRecord {
  id: number
  subject: string
  questions_count: number
  correct_count: number
  study_time: number
  created_at: string
}

export default function LearningProgressPage() {
  const { message } = App.useApp()
  const [stats, setStats] = useState<LearningStats | null>(null)
  const [progressRecords, setProgressRecords] = useState<ProgressRecord[]>([])
  const [loading, setLoading] = useState(true)

  // ✅ 与 antd RangePicker 的类型对齐：值可以是 [Dayjs|null, Dayjs|null] 或 null
  const [timeRange, setTimeRange] = useState<[Dayjs | null, Dayjs | null] | null>([
    dayjs().subtract(30, 'day'),
    dayjs(),
  ])
  const [selectedSubject, setSelectedSubject] = useState<string>('all')
  const [subjects, setSubjects] = useState<string[]>([])

  useEffect(() => {
    fetchLearningStats()
    fetchProgressRecords()
    fetchSubjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, selectedSubject])

  const pickData = <T,>(resp: any, defaultVal: T): T => {
    // 兼容 ApiResult<T> 与 axios 风格
    if (isSuccess<T>(resp)) return (resp.data as T) ?? defaultVal
    const d = resp?.data
    if (Array.isArray(d)) return (d as unknown as T) ?? defaultVal
    if (d?.data !== undefined) return (d.data as T) ?? defaultVal
    return (d as T) ?? defaultVal
  }

  const fetchLearningStats = async () => {
    try {
      setLoading(true)
      const params = {
        start_date: timeRange?.[0]?.format('YYYY-MM-DD') || undefined,
        end_date: timeRange?.[1]?.format('YYYY-MM-DD') || undefined,
        subject: selectedSubject !== 'all' ? selectedSubject : undefined,
      }
      const resp: ApiResult<any> | any = await api.get('/learning-progress/stats', { params })
      const data = pickData<any>(resp, {})
      // 允许后端直接返回对象或 { stats: {...} }
      const s: LearningStats = data?.stats ?? {
        total_study_time: Number(data?.total_study_time ?? 0),
        questions_practiced: Number(data?.questions_practiced ?? 0),
        correct_rate: Number(data?.correct_rate ?? 0),
        streak_days: Number(data?.streak_days ?? 0),
        subjects_studied: Number(data?.subjects_studied ?? 0),
        avg_score: Number(data?.avg_score ?? 0),
      }
      setStats(s)
    } catch (error) {
      console.error('获取学习统计失败:', error)
      message.error('获取学习统计失败')
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
  }

  const fetchProgressRecords = async () => {
    try {
      const params = {
        start_date: timeRange?.[0]?.format('YYYY-MM-DD') || undefined,
        end_date: timeRange?.[1]?.format('YYYY-MM-DD') || undefined,
        subject: selectedSubject !== 'all' ? selectedSubject : undefined,
        limit: 20,
      }
      const resp: ApiResult<any> | any = await api.get('/learning-progress/records', { params })
      const data = pickData<any>(resp, [])
      const list: ProgressRecord[] = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.records)
        ? data.records
        : Array.isArray(data)
        ? data
        : []
      setProgressRecords(list)
    } catch (error) {
      console.error('获取学习记录失败:', error)
      message.error('获取学习记录失败')
      setProgressRecords([])
    }
  }

  const fetchSubjects = async () => {
    try {
      const resp: ApiResult<any> | any = await api.get('/learning-progress/subjects')
      const data = pickData<any>(resp, [])
      const list: string[] = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.subjects)
        ? data.subjects
        : Array.isArray(data)
        ? data
        : []
      setSubjects(list)
    } catch (error) {
      console.error('获取科目列表失败:', error)
      // 静默失败，保持原有 subjects
    }
  }

  const onRangeChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    setTimeRange(dates)
  }

  const formatTime = (minutes: number) => {
    const mins = Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : 0
    const hours = Math.floor(mins / 60)
    const left = mins % 60
    return hours > 0 ? `${hours}小时${left}分钟` : `${left}分钟`
  }

  const getProgressColor = (rate: number) => {
    const val = Number.isFinite(rate) ? rate : 0
    if (val >= 80) return '#52c41a'
    if (val >= 60) return '#faad14'
    return '#ff4d4f'
  }

  const correctRate = Number(stats?.correct_rate ?? 0)
  const avgScore = Number(stats?.avg_score ?? 0)

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <Space>
          <TrendingUp style={{ width: 24, height: 24, color: '#1890ff' }} />
          <Title level={2} style={{ margin: 0 }}>
            学习进度
          </Title>
        </Space>
        <Space>
          <Select value={selectedSubject} onChange={setSelectedSubject} style={{ width: 120 }}>
            <Option value="all">全部科目</Option>
            {subjects.map(subject => (
              <Option key={subject} value={subject}>
                {subject}
              </Option>
            ))}
          </Select>
          <RangePicker value={timeRange} onChange={onRangeChange} format="YYYY-MM-DD" />
        </Space>
      </div>

      <Spin spinning={loading}>
        {/* 统计卡片 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="总学习时长"
                value={stats?.total_study_time || 0}
                formatter={value => formatTime(Number(value))}
                prefix={<Clock className="w-4 h-4 text-blue-500" />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="练习题目数"
                value={stats?.questions_practiced || 0}
                prefix={<BookOpen className="w-4 h-4 text-green-500" />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="正确率"
                value={correctRate || 0}
                precision={1}
                suffix="%"
                prefix={<Target className="w-4 h-4 text-orange-500" />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="连续学习天数"
                value={stats?.streak_days || 0}
                suffix="天"
                prefix={<Award className="w-4 h-4 text-purple-500" />}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          {/* 学习进度图表 */}
          <Col xs={24} lg={16}>
            <Card title="学习进度概览" style={{ height: '100%' }}>
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <div>
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}
                  >
                    <Text>总体完成度</Text>
                    <Text strong>{correctRate.toFixed(1)}%</Text>
                  </div>
                  <Progress percent={correctRate} strokeColor={getProgressColor(correctRate)} />
                </div>

                <div>
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}
                  >
                    <Text>平均分数</Text>
                    <Text strong>{avgScore.toFixed(1)}分</Text>
                  </div>
                  <Progress percent={avgScore} strokeColor={getProgressColor(avgScore)} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24 }}>
                  <Card size="small" style={{ textAlign: 'center', backgroundColor: '#f0f8ff' }}>
                    <Title level={2} style={{ margin: 0, color: '#1890ff' }}>
                      {stats?.subjects_studied || 0}
                    </Title>
                    <Text type="secondary">已学习科目</Text>
                  </Card>
                  <Card size="small" style={{ textAlign: 'center', backgroundColor: '#f6ffed' }}>
                    <Title level={2} style={{ margin: 0, color: '#52c41a' }}>
                      {Math.round((stats?.total_study_time || 0) / 60)}
                    </Title>
                    <Text type="secondary">学习小时数</Text>
                  </Card>
                </div>
              </Space>
            </Card>
          </Col>

          {/* 学习记录时间线 */}
          <Col xs={24} lg={8}>
            <Card title="最近学习记录" style={{ height: '100%' }}>
              {progressRecords.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <Calendar style={{ width: 48, height: 48, color: '#d9d9d9', margin: '0 auto 8px' }} />
                  <Text type="secondary">暂无学习记录</Text>
                </div>
              ) : (
                <Timeline
                  items={progressRecords.map(record => {
                    const rate = record.questions_count ? (record.correct_count / record.questions_count) * 100 : 0
                    return {
                      key: record.id,
                      color: getProgressColor(rate),
                      children: (
                        <div>
                          <Text strong>{record.subject}</Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: 14 }}>
                            {record.questions_count}题 · 正确率{rate.toFixed(1)}%
                          </Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: 14 }}>
                            学习时长: {formatTime(record.study_time)}
                          </Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {dayjs(record.created_at).format('MM-DD HH:mm')}
                          </Text>
                        </div>
                      ),
                    }
                  })}
                />
              )}
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  )
}
