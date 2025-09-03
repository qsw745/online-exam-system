import { FilterOutlined, SearchOutlined } from '@ant-design/icons'
import { api } from '@shared/api/http'
import LoadingSpinner from '@shared/components/LoadingSpinner'
import { createPaginationConfig } from '@shared/constants/pagination'
import { useAuth } from '@shared/contexts/AuthContext'
import { useLanguage } from '@shared/contexts/LanguageContext'
import { Button, Card, Col, Empty, Input, message, Pagination, Row, Select, Space, Tag, Typography } from 'antd'
import { BookOpen, Clock, Play, Users } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
const { Search } = Input
const { Option } = Select
const { Title, Paragraph } = Typography

interface Exam {
  id: number
  title: string
  description: string
  duration: number
  total_score: number
  status: 'draft' | 'published' | 'archived'
  start_time?: string
  end_time?: string
  created_at: string
  updated_at: string
  question_count?: number
  participant_count?: number
}

interface ExamListResponse {
  exams: Exam[]
  total: number
  page: number
  limit: number
}

export default function ExamListPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [exams, setExams] = useState<Exam[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 10

  // 加载考试列表
  const loadExams = async (page = 1, search = '', status = 'all') => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
        ...(status !== 'all' && { status }),
      })

      const response = await api.get(`/exams?${params}`)

      if ((response as any)?.data) {
        const data: ExamListResponse = (response as any).data
        setExams(data.exams)
        setTotal(data.total)
        setTotalPages(Math.ceil(data.total / limit))
      } else {
        message.error((response as any)?.data?.error || '加载考试列表失败')
      }
    } catch (error) {
      console.error('加载考试列表失败:', error)
      message.error('加载考试列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadExams(currentPage, searchTerm, filterStatus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, searchTerm, filterStatus])

  // ✅ 搜索处理（按 antd Search 的签名）
  const handleSearch = (value: string) => {
    setSearchTerm(value)
    setCurrentPage(1)
    loadExams(1, value, filterStatus)
  }

  // 筛选处理
  const handleFilterChange = (status: string) => {
    setFilterStatus(status)
    setCurrentPage(1)
    loadExams(1, searchTerm, status)
  }

  // 格式化时间
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}小时${mins > 0 ? mins + '分钟' : ''}`
    }
    return `${mins}分钟`
  }

  // 获取状态标签
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: '草稿', color: 'default' as any },
      published: { label: '已发布', color: 'success' as any },
      archived: { label: '已归档', color: 'error' as any },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft

    return <Tag color={config.color}>{config.label}</Tag>
  }

  if (loading && exams.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: '24px' }}>
        <Title level={2} style={{ margin: 0 }}>
          考试列表
        </Title>
        <Paragraph type="secondary" style={{ margin: '8px 0 0 0' }}>
          查看和参加可用的考试
        </Paragraph>
      </div>

      {/* 搜索和筛选 */}
      <Card style={{ marginBottom: '24px' }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={16}>
            <Search
              placeholder="搜索考试..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onSearch={handleSearch}
              prefix={<SearchOutlined />}
              allowClear
              size="large"
            />
          </Col>
          <Col xs={24} md={8}>
            <Space>
              <FilterOutlined style={{ color: '#8c8c8c' }} />
              <Select value={filterStatus} onChange={handleFilterChange} style={{ width: 120 }} size="large">
                <Option value="all">所有状态</Option>
                <Option value="published">已发布</Option>
                <Option value="draft">草稿</Option>
                <Option value="archived">已归档</Option>
              </Select>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 考试列表 */}
      <div style={{ marginBottom: '24px' }}>
        {exams.length === 0 ? (
          <Empty
            image={<BookOpen size={64} style={{ color: '#d9d9d9' }} />}
            description={
              <span>
                <div style={{ fontSize: '16px', fontWeight: 500, marginBottom: '8px' }}>暂无考试</div>
                <div style={{ color: '#8c8c8c' }}>当前没有可用的考试</div>
              </span>
            }
          />
        ) : (
          <Row gutter={[16, 16]}>
            {exams.map(exam => (
              <Col xs={24} key={exam.id}>
                <Card
                  hoverable
                  style={{ marginBottom: '16px' }}
                  actions={[
                    exam.status === 'published' ? (
                      <Link to={`/exam/${exam.id}`} key="start">
                        <Button type="primary" icon={<Play className="w-4 h-4" />}>
                          开始考试
                        </Button>
                      </Link>
                    ) : (
                      <Button disabled key="disabled">
                        暂不可用
                      </Button>
                    ),
                  ]}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <Title level={4} style={{ margin: 0 }}>
                          {exam.title}
                        </Title>
                        {getStatusBadge(exam.status)}
                      </div>

                      {exam.description && (
                        <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: '16px', color: '#666' }}>
                          {exam.description}
                        </Paragraph>
                      )}

                      <Space size="large" style={{ color: '#8c8c8c' }}>
                        <Space size="small">
                          <Clock className="w-4 h-4" />
                          <span>{formatDuration(exam.duration)}</span>
                        </Space>

                        <Space size="small">
                          <BookOpen className="w-4 h-4" />
                          <span>{exam.total_score}分</span>
                        </Space>

                        {exam.question_count && (
                          <Space size="small">
                            <span>{exam.question_count}题</span>
                          </Space>
                        )}

                        {exam.participant_count !== undefined && (
                          <Space size="small">
                            <Users className="w-4 h-4" />
                            <span>{exam.participant_count}人参加</span>
                          </Space>
                        )}
                      </Space>

                      {(exam.start_time || exam.end_time) && (
                        <div style={{ marginTop: '12px', fontSize: '14px', color: '#8c8c8c' }}>
                          {exam.start_time && <div>开始时间: {new Date(exam.start_time).toLocaleString()}</div>}
                          {exam.end_time && <div>结束时间: {new Date(exam.end_time).toLocaleString()}</div>}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
          <Pagination
            current={currentPage}
            total={total}
            pageSize={limit}
            onChange={page => setCurrentPage(page)}
            {...createPaginationConfig({
              pageSizeOptions: ['6', '12', '18', '24'],
            })}
          />
        </div>
      )}
    </div>
  )
}
