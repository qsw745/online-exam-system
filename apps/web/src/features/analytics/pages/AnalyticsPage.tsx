import { api } from '@shared/api/http'
import { App, Card, Col, DatePicker, Pagination, Progress, Row, Select, Spin, Statistic, Table } from 'antd'
import dayjs from 'dayjs'
import { Award, BarChart3, BookOpen, PieChart, Target, TrendingUp, Users } from 'lucide-react'
import { useEffect, useState } from 'react'

import { createPaginationConfig } from '@shared/constants/pagination'
const { RangePicker } = DatePicker
const { Option } = Select

interface AnalyticsData {
  overview: {
    total_students: number
    total_questions: number
    total_exams: number
    avg_score: number
    completion_rate: number
    active_students: number
  }
  trends: {
    date: string
    students_count: number
    exams_count: number
    avg_score: number
  }[]
  subjects: {
    subject: string
    questions_count: number
    avg_score: number
    completion_rate: number
  }[]
  students: {
    user_id: number
    username: string
    total_score: number
    exams_completed: number
    avg_score: number
    study_time: number
    last_active: string
  }[]
}

export default function AnalyticsPage() {
  const { message } = App.useApp()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>([dayjs().subtract(30, 'day'), dayjs()])
  const [selectedSubject, setSelectedSubject] = useState<string>('all')
  const [subjects, setSubjects] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalStudents, setTotalStudents] = useState(0)

  useEffect(() => {
    fetchAnalytics()
    fetchSubjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, selectedSubject])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const params = {
        start_date: timeRange?.[0]?.format('YYYY-MM-DD'),
        end_date: timeRange?.[1]?.format('YYYY-MM-DD'),
        subject: selectedSubject !== 'all' ? selectedSubject : undefined,
      }
      const res = await api.get<AnalyticsData>('/analytics', { params })
      if ('success' in res && res.success) {
        const analyticsData = res.data || ({} as AnalyticsData)
        setData(analyticsData)
        setTotalStudents(analyticsData.students?.length || 0)
      } else {
        const errMsg = 'error' in res ? res.error : '获取统计数据失败'
        message.error(errMsg || '获取统计数据失败')
      }
    } catch (error) {
      console.error('获取统计数据失败:', error)
      message.error('获取统计数据失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchSubjects = async () => {
    try {
      const res = await api.get<string[]>('/analytics/subjects')
      if ('success' in res && res.success) {
        setSubjects(res.data || [])
      }
    } catch (error) {
      console.error('获取科目列表失败:', error)
    }
  }

  // 分页处理函数
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handlePageSizeChange = (_current: number, size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  // 处理 RangePicker 变化（修复类型不匹配）
  const handleRangeChange = (
    dates: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null,
    _dateStrings: [string, string]
  ) => {
    if (dates && dates[0] && dates[1]) {
      setTimeRange([dates[0], dates[1]])
    } else {
      setTimeRange(null)
    }
  }

  // 获取当前页学生数据
  const getCurrentPageStudents = () => {
    if (!data?.students) return []
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return data.students.slice(startIndex, endIndex)
  }

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}h${mins}m` : `${mins}m`
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return '#52c41a'
    if (score >= 80) return '#1890ff'
    if (score >= 70) return '#faad14'
    if (score >= 60) return '#fa8c16'
    return '#ff4d4f'
  }

  const studentColumns = [
    {
      title: '学生',
      dataIndex: 'username',
      key: 'username',
      render: (username: string, record: any) => (
        <div>
          <div className="font-medium">{username}</div>
          <div className="text-xs text-gray-500">ID: {record.user_id}</div>
        </div>
      ),
    },
    {
      title: '平均分',
      dataIndex: 'avg_score',
      key: 'avg_score',
      sorter: (a: any, b: any) => b.avg_score - a.avg_score,
      render: (score: number) => (
        <div className="text-center">
          <div className="font-bold" style={{ color: getScoreColor(score) }}>
            {score.toFixed(1)}
          </div>
          <Progress percent={score} size="small" strokeColor={getScoreColor(score)} showInfo={false} />
        </div>
      ),
    },
    {
      title: '完成考试',
      dataIndex: 'exams_completed',
      key: 'exams_completed',
      sorter: (a: any, b: any) => b.exams_completed - a.exams_completed,
      render: (count: number) => <div className="text-center font-medium">{count}</div>,
    },
    {
      title: '总分',
      dataIndex: 'total_score',
      key: 'total_score',
      sorter: (a: any, b: any) => b.total_score - a.total_score,
      render: (score: number) => <div className="text-center font-medium">{score.toFixed(1)}</div>,
    },
    {
      title: '学习时长',
      dataIndex: 'study_time',
      key: 'study_time',
      sorter: (a: any, b: any) => b.study_time - a.study_time,
      render: (time: number) => <div className="text-center">{formatTime(time)}</div>,
    },
    {
      title: '最后活跃',
      dataIndex: 'last_active',
      key: 'last_active',
      render: (time: string) => <div className="text-sm text-gray-600">{dayjs(time).format('MM-DD HH:mm')}</div>,
    },
  ]

  const subjectColumns = [
    {
      title: '科目',
      dataIndex: 'subject',
      key: 'subject',
      render: (subject: string) => <div className="font-medium">{subject}</div>,
    },
    {
      title: '题目数量',
      dataIndex: 'questions_count',
      key: 'questions_count',
      sorter: (a: any, b: any) => b.questions_count - a.questions_count,
      render: (count: number) => <div className="text-center font-medium">{count}</div>,
    },
    {
      title: '平均分',
      dataIndex: 'avg_score',
      key: 'avg_score',
      sorter: (a: any, b: any) => b.avg_score - a.avg_score,
      render: (score: number) => (
        <div className="text-center">
          <div className="font-bold" style={{ color: getScoreColor(score) }}>
            {score.toFixed(1)}
          </div>
          <Progress percent={score} size="small" strokeColor={getScoreColor(score)} showInfo={false} />
        </div>
      ),
    },
    {
      title: '完成率',
      dataIndex: 'completion_rate',
      key: 'completion_rate',
      sorter: (a: any, b: any) => b.completion_rate - a.completion_rate,
      render: (rate: number) => (
        <div className="text-center">
          <div className="font-medium">{rate.toFixed(1)}%</div>
          <Progress
            percent={rate}
            size="small"
            strokeColor={rate >= 80 ? '#52c41a' : rate >= 60 ? '#faad14' : '#ff4d4f'}
            showInfo={false}
          />
        </div>
      ),
    },
  ]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <BarChart3 className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold">数据统计</h1>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={selectedSubject} onChange={setSelectedSubject} style={{ width: 120 }}>
            <Option value="all">全部科目</Option>
            {subjects.map(subject => (
              <Option key={subject} value={subject}>
                {subject}
              </Option>
            ))}
          </Select>
          <RangePicker value={timeRange} onChange={handleRangeChange} format="YYYY-MM-DD" />
        </div>
      </div>

      <Spin spinning={loading}>
        {data && (
          <div className="space-y-6">
            {/* 概览统计 */}
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={4}>
                <Card>
                  <Statistic
                    title="总学生数"
                    value={data.overview?.total_students || 0}
                    prefix={<Users className="w-4 h-4 text-blue-500" />}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={4}>
                <Card>
                  <Statistic
                    title="活跃学生"
                    value={data.overview?.active_students || 0}
                    prefix={<TrendingUp className="w-4 h-4 text-green-500" />}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={4}>
                <Card>
                  <Statistic
                    title="总题目数"
                    value={data.overview?.total_questions || 0}
                    prefix={<BookOpen className="w-4 h-4 text-purple-500" />}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={4}>
                <Card>
                  <Statistic
                    title="总考试数"
                    value={data.overview?.total_exams || 0}
                    prefix={<Award className="w-4 h-4 text-orange-500" />}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={4}>
                <Card>
                  <Statistic
                    title="平均分"
                    value={data.overview?.avg_score || 0}
                    precision={1}
                    prefix={<Target className="w-4 h-4 text-red-500" />}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={4}>
                <Card>
                  <Statistic
                    title="完成率"
                    value={data.overview?.completion_rate || 0}
                    precision={1}
                    suffix="%"
                    prefix={<PieChart className="w-4 h-4 text-cyan-500" />}
                  />
                </Card>
              </Col>
            </Row>

            {/* 科目统计 */}
            <Card title="科目统计" className="mb-6">
              <Table
                columns={subjectColumns}
                dataSource={data.subjects || []}
                rowKey="subject"
                pagination={false}
                size="small"
              />
            </Card>

            {/* 学生表现 */}
            <Card title="学生表现">
              <Table
                columns={studentColumns}
                dataSource={getCurrentPageStudents()}
                rowKey="user_id"
                pagination={false}
                size="small"
              />
              <Pagination
                current={currentPage}
                total={totalStudents}
                pageSize={pageSize}
                onChange={handlePageChange}
                onShowSizeChange={handlePageSizeChange}
                {...createPaginationConfig()}
              />
            </Card>
          </div>
        )}
      </Spin>
    </div>
  )
}
