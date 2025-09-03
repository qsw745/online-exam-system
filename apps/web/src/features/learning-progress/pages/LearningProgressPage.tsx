import React, { useState, useEffect } from 'react'
import { Card, Row, Col, Progress, Statistic, Timeline, Select, DatePicker, Spin, App, Space, Typography } from 'antd'
import { TrendingUp, BookOpen, Target, Clock, Award, Calendar } from 'lucide-react'
import { api } from '../lib/api'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker
const { Option } = Select
const { Title, Text } = Typography

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
  const [timeRange, setTimeRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>([
    dayjs().subtract(30, 'day'),
    dayjs()
  ])
  const [selectedSubject, setSelectedSubject] = useState<string>('all')
  const [subjects, setSubjects] = useState<string[]>([])

  useEffect(() => {
    fetchLearningStats()
    fetchProgressRecords()
    fetchSubjects()
  }, [timeRange, selectedSubject])

  const fetchLearningStats = async () => {
    try {
      setLoading(true)
      const params = {
        start_date: timeRange?.[0]?.format('YYYY-MM-DD'),
        end_date: timeRange?.[1]?.format('YYYY-MM-DD'),
        subject: selectedSubject !== 'all' ? selectedSubject : undefined
      }
      const response = await api.get('/learning-progress/stats', { params })
      setStats(response.data.data || {})
    } catch (error) {
      console.error('获取学习统计失败:', error)
      message.error('获取学习统计失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchProgressRecords = async () => {
    try {
      const params = {
        start_date: timeRange?.[0]?.format('YYYY-MM-DD'),
        end_date: timeRange?.[1]?.format('YYYY-MM-DD'),
        subject: selectedSubject !== 'all' ? selectedSubject : undefined,
        limit: 20
      }
      const response = await api.get('/learning-progress/records', { params })
      setProgressRecords(response.data.data || [])
    } catch (error) {
      console.error('获取学习记录失败:', error)
      message.error('获取学习记录失败')
    }
  }

  const fetchSubjects = async () => {
    try {
      const response = await api.get('/learning-progress/subjects')
      setSubjects(response.data.data || [])
    } catch (error) {
      console.error('获取科目列表失败:', error)
    }
  }

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}小时${mins}分钟` : `${mins}分钟`
  }

  const getProgressColor = (rate: number) => {
    if (rate >= 80) return '#52c41a'
    if (rate >= 60) return '#faad14'
    return '#ff4d4f'
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <Space>
          <TrendingUp style={{ width: 24, height: 24, color: '#1890ff' }} />
          <Title level={2} style={{ margin: 0 }}>学习进度</Title>
        </Space>
        <Space>
          <Select
            value={selectedSubject}
            onChange={setSelectedSubject}
            style={{ width: 120 }}
          >
            <Option value="all">全部科目</Option>
            {subjects.map(subject => (
              <Option key={subject} value={subject}>{subject}</Option>
            ))}
          </Select>
          <RangePicker
            value={timeRange}
            onChange={setTimeRange}
            format="YYYY-MM-DD"
          />
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
                formatter={(value) => formatTime(Number(value))}
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
                value={stats?.correct_rate || 0}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text>总体完成度</Text>
                    <Text strong>{stats?.correct_rate?.toFixed(1) || 0}%</Text>
                  </div>
                  <Progress 
                    percent={stats?.correct_rate || 0} 
                    strokeColor={getProgressColor(stats?.correct_rate || 0)}
                  />
                </div>
                
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text>平均分数</Text>
                    <Text strong>{stats?.avg_score?.toFixed(1) || 0}分</Text>
                  </div>
                  <Progress 
                    percent={(stats?.avg_score || 0) / 100 * 100} 
                    strokeColor={getProgressColor((stats?.avg_score || 0) / 100 * 100)}
                  />
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
                  items={progressRecords.map(record => ({
                    key: record.id,
                    color: getProgressColor((record.correct_count / record.questions_count) * 100),
                    children: (
                      <div>
                        <Text strong>{record.subject}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 14 }}>
                          {record.questions_count}题 · 正确率{((record.correct_count / record.questions_count) * 100).toFixed(1)}%
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
                    )
                  }))}
                />
              )}
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  )
}