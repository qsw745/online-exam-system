import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { Calendar, Clock, Trophy, FileText, TrendingUp, BookmarkPlus } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import { Link } from 'react-router-dom'
import { message, Card, Row, Col, Statistic, List, Tag, Typography, Space, Empty } from 'antd'
import { api } from '../lib/api'

const { Title, Text } = Typography

interface Task {
  id: string
  title: string
  type: string
  status: string
  start_time: string
  end_time: string
}

interface Result {
  id: string
  paper_title: string
  score: number
  total_score: number
  created_at: string
}

interface Stats {
  total_tasks: number
  completed_tasks: number
  average_score: number
  best_score: number
}

const DashboardPage: React.FC = () => {
  const { user } = useAuth()
  const { t, language } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats>({
    total_tasks: 0,
    completed_tasks: 0,
    average_score: 0,
    best_score: 0
  })
  const [recentTasks, setRecentTasks] = useState<Task[]>([])
  const [recentResults, setRecentResults] = useState<Result[]>([])

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      const defaultStats = {
        total_tasks: 0,
        completed_tasks: 0,
        average_score: 0,
        best_score: 0
      }

      const [statsResponse, tasksResponse, resultsResponse] = await Promise.all([
        api.get('/dashboard/stats').catch(() => ({ success: false, error: t('dashboard.stats_api_undefined') })),
        api.get('/tasks', { params: { limit: 5, sort: 'start_time' } }).catch(() => ({ success: false, error: t('dashboard.tasks_api_undefined') })),
        api.get('/exam_results', { params: { limit: 5, sort: 'created_at' } }).catch(() => ({ success: false, error: t('dashboard.results_api_undefined') }))
      ])

      if (statsResponse?.success) {
        setStats(statsResponse?.data ?? defaultStats)
      } else {
        console.error(t('dashboard.stats_load_error'), statsResponse?.error)
        message.error(t('dashboard.stats_load_error'))
        setStats(defaultStats)
      }

      if (tasksResponse?.success) {
        setRecentTasks(tasksResponse?.data?.tasks ?? [])
      } else {
        console.error(t('dashboard.tasks_load_error'), tasksResponse?.error)
        message.error(t('dashboard.tasks_load_error'))
        setRecentTasks([])
      }

      if (resultsResponse?.success) {
        setRecentResults(resultsResponse?.data?.results ?? [])
      } else {
        console.error(t('dashboard.results_load_error'), resultsResponse?.error)
        message.error(t('dashboard.results_load_error'))
        setRecentResults([])
      }
    } catch (error: any) {
      console.error(t('dashboard.load_error'), error)
      message.error(error.message || t('dashboard.load_error'))
      setStats({
        total_tasks: 0,
        completed_tasks: 0,
        average_score: 0,
        best_score: 0
      })
      setRecentTasks([])
      setRecentResults([])
    } finally {
      setLoading(false)
    }
  }

  const getStatusLabel = (status: string) => {
    const statusMap = {
      'not_started': t('dashboard.status_not_started'),
      'in_progress': t('dashboard.status_in_progress'),
      'completed': t('dashboard.status_completed'),
      'expired': t('dashboard.status_expired')
    }
    return statusMap[status as keyof typeof statusMap] || status
  }

  const getStatusTagColor = (status: string) => {
    const colorMap = {
      'not_started': 'default',
      'in_progress': 'processing',
      'completed': 'success',
      'expired': 'error'
    }
    return colorMap[status as keyof typeof colorMap] || 'default'
  }

  if (loading) {
    return <LoadingSpinner text={t('dashboard.loading')} />
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* 页面标题 */}
      <div>
        <Title level={2} style={{ marginBottom: 8 }}>{t('dashboard.title')}</Title>
        <Text type="secondary">{t('dashboard.description')}</Text>
      </div>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('dashboard.total_tasks')}
              value={stats.total_tasks}
              prefix={<FileText style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('dashboard.completed_tasks')}
              value={stats.completed_tasks}
              prefix={<Clock style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('dashboard.average_score')}
              value={stats.average_score}
              precision={1}
              prefix={<TrendingUp style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('dashboard.best_score')}
              value={stats.best_score}
              prefix={<Trophy style={{ color: '#f5222d' }} />}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 最近任务和成绩 */}
      <Row gutter={[16, 16]}>
        {/* 最近任务 */}
        <Col xs={24} lg={12}>
          <Card
            title={t('dashboard.recent_tasks')}
            extra={
              <Link to="/tasks" style={{ color: '#1890ff' }}>
                {t('dashboard.view_all')}
              </Link>
            }
          >
            {recentTasks.length > 0 ? (
              <List
                dataSource={recentTasks}
                renderItem={(task) => (
                  <List.Item>
                    <List.Item.Meta
                      title={<Text strong>{task.title}</Text>}
                      description={
                        <Space>
                          <Calendar style={{ width: 14, height: 14 }} />
                          <Text type="secondary">
                            {t('dashboard.start_time')}: {new Date(task.start_time).toLocaleString(language === 'zh-CN' ? 'zh-CN' : 'en-US')}
                          </Text>
                        </Space>
                      }
                    />
                    <Space>
                      <Tag color={task.type === 'exam' ? 'red' : 'blue'}>
                        {task.type === 'exam' ? t('dashboard.exam') : t('dashboard.practice')}
                      </Tag>
                      <Tag color={getStatusTagColor(task.status)}>
                        {getStatusLabel(task.status)}
                      </Tag>
                    </Space>
                  </List.Item>
                )}
              />
            ) : (
              <Empty
                image={<BookmarkPlus style={{ width: 48, height: 48, color: '#d9d9d9' }} />}
                description={t('dashboard.no_tasks')}
              />
            )}
          </Card>
        </Col>

        {/* 最近成绩 */}
        <Col xs={24} lg={12}>
          <Card
            title={t('dashboard.recent_results')}
            extra={
              <Link to="/results" style={{ color: '#1890ff' }}>
                {t('dashboard.view_all')}
              </Link>
            }
          >
            {recentResults.length > 0 ? (
              <List
                dataSource={recentResults}
                renderItem={(result) => (
                  <List.Item>
                    <List.Item.Meta
                      title={<Text strong>{result.paper_title}</Text>}
                      description={
                        <Space>
                           <Calendar style={{ width: 14, height: 14 }} />
                           <Text type="secondary">
                             {t('dashboard.submit_time')}: {new Date(result.created_at).toLocaleString(language === 'zh-CN' ? 'zh-CN' : 'en-US')}
                           </Text>
                         </Space>
                      }
                    />
                    <div style={{ textAlign: 'right' }}>
                      <Text strong style={{ fontSize: '16px' }}>
                        {result.score} / {result.total_score}
                      </Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {t('dashboard.score')}
                      </Text>
                    </div>
                  </List.Item>
                )}
              />
            ) : (
              <Empty
                 image={<BookmarkPlus style={{ width: 48, height: 48, color: '#d9d9d9' }} />}
                 description={t('dashboard.no_results')}
               />
            )}
          </Card>
        </Col>
      </Row>
    </Space>
  )
}

export default DashboardPage
