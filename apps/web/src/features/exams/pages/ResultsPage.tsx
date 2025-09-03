import { useAuth } from '@shared/contexts/AuthContext'
import { useLanguage } from '@shared/contexts/LanguageContext'
import { Card, Col, Empty, Input, Pagination, Row, Select, Space, Spin, Tag, Typography, message } from 'antd'
import { BookmarkPlus, Clock, Eye, Filter, Search } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
// import LoadingSpinner from '@shared/components/LoadingSpinner' // 本页未使用，删掉即可
import { api } from '@shared/api/http'
import { createPaginationConfig } from '@shared/constants/pagination'

// import LoadingSpinner from '@shared/components/LoadingSpinner' // 本页未使用，删掉即可

const { Title, Text } = Typography
const { Option } = Select

interface Result {
  id: string
  paper_id: string
  paper_title: string
  score: number
  total_score: number
  start_time: string
  end_time: string
  status: string
  created_at: string
  updated_at: string
}

interface State {
  results: Result[]
  loading: boolean
  searchTerm: string
  filterStatus: string
  // 分页状态
  currentPage: number
  totalPages: number
  totalResults: number
  pageSize: number
}

const ResultsPage: React.FC = () => {
  const { user } = useAuth()
  const { t, language } = useLanguage()
  const [state, setState] = useState<State>({
    results: [],
    loading: true,
    searchTerm: '',
    filterStatus: 'all',
    // 分页状态
    currentPage: 1,
    totalPages: 1,
    totalResults: 0,
    pageSize: 12,
  })

  useEffect(() => {
    loadResults()
  }, [state.currentPage, state.searchTerm, state.filterStatus])

  const loadResults = async () => {
    try {
      setState(prev => ({ ...prev, loading: true }))
      const { data } = await api.get('/exam_results', {
        params: {
          page: state.currentPage,
          limit: state.pageSize,
          status: state.filterStatus === 'all' ? undefined : state.filterStatus,
          search: state.searchTerm || undefined,
        },
      })

      setState(prev => ({
        ...prev,
        results: data.results || [],
        totalPages: data.pagination?.totalPages || 1,
        totalResults: data.pagination?.total || 0,
        loading: false,
      }))
    } catch (error: any) {
      console.error('加载考试结果错误:', error)
      message.error(error.response?.data?.message || '加载考试结果失败')
      setState(prev => ({ ...prev, loading: false }))
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    loadResults()
  }

  const handleFilterChange = (value: string) => {
    setState(prev => ({ ...prev, filterStatus: value, currentPage: 1 }))
  }

  // 分页控制函数
  const handlePageChange = (page: number) => {
    setState(prev => ({ ...prev, currentPage: page }))
  }

  const handlePrevPage = () => {
    if (state.currentPage > 1) {
      setState(prev => ({ ...prev, currentPage: prev.currentPage - 1 }))
    }
  }

  const handleNextPage = () => {
    if (state.currentPage < state.totalPages) {
      setState(prev => ({ ...prev, currentPage: prev.currentPage + 1 }))
    }
  }

  // 搜索处理
  const handleSearchChange = (value: string) => {
    setState(prev => ({ ...prev, searchTerm: value, currentPage: 1 }))
  }

  const getStatusLabel = (status: string) => {
    const statusMap = {
      completed: t('results.status_completed'),
      in_progress: t('results.status_in_progress'),
      not_started: t('results.status_not_started'),
    }
    return statusMap[status as keyof typeof statusMap] || status
  }

  const getStatusColor = (status: string) => {
    const colorMap = {
      completed: 'bg-green-100 text-green-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      not_started: 'bg-gray-100 text-gray-800',
    }
    return colorMap[status as keyof typeof colorMap] || 'bg-gray-100 text-gray-800'
  }

  const getStatusTagColor = (status: string) => {
    const colorMap = {
      completed: 'success',
      in_progress: 'warning',
      not_started: 'default',
    }
    return colorMap[status as keyof typeof colorMap] || 'default'
  }

  if (state.loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <Spin size="large" tip={t('results.loading')}>
          <div style={{ minHeight: '200px', minWidth: '200px' }} />
        </Spin>
      </div>
    )
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%', padding: '24px' }}>
      {/* 页面标题 */}
      <div>
        <Title level={2}>{t('results.title')}</Title>
        <Text type="secondary">{t('results.description')}</Text>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={16}>
            <Input
              prefix={<Search style={{ width: 16, height: 16, color: '#999' }} />}
              value={state.searchTerm}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder={t('results.search_placeholder')}
              allowClear
            />
          </Col>
          <Col xs={24} md={8}>
            <Space>
              <Filter style={{ width: 16, height: 16, color: '#999' }} />
              <Select value={state.filterStatus} onChange={handleFilterChange} style={{ width: 200 }}>
                <Option value="all">{t('results.all_status')}</Option>
                <Option value="completed">{t('results.status_completed')}</Option>
                <Option value="in_progress">{t('results.status_in_progress')}</Option>
                <Option value="not_started">{t('results.status_not_started')}</Option>
              </Select>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 结果列表 */}
      <Row gutter={[16, 16]}>
        {state.results.map(result => (
          <Col key={result.id} xs={24} md={12} lg={8}>
            <Card
              hoverable
              actions={[
                <Link to={`/results/${result.id}`} key="view">
                  <Space>
                    <Eye style={{ width: 16, height: 16 }} />
                    <span>{t('results.view_details')}</span>
                  </Space>
                </Link>,
              ]}
            >
              <Card.Meta
                title={
                  <Link to={`/results/${result.id}`} style={{ color: 'inherit' }}>
                    {result.paper_title}
                  </Link>
                }
                description={
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <Space>
                      <BookmarkPlus style={{ width: 16, height: 16 }} />
                      <Text type="secondary">
                        {t('results.score_display')}: {result.score} / {result.total_score}
                      </Text>
                    </Space>
                    <Space>
                      <Clock style={{ width: 16, height: 16 }} />
                      <Text type="secondary">
                        {t('results.start_time')}:{' '}
                        {new Date(result.start_time).toLocaleString(language === 'zh-CN' ? 'zh-CN' : 'en-US')}
                      </Text>
                    </Space>
                    <div style={{ marginTop: '8px' }}>
                      <Tag color={getStatusTagColor(result.status)}>{getStatusLabel(result.status)}</Tag>
                    </div>
                  </Space>
                }
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* 空状态 */}
      {state.results.length === 0 && (
        <Empty
          image={<BookmarkPlus style={{ width: 48, height: 48, color: '#d9d9d9' }} />}
          description={
            <Space direction="vertical">
              <Text strong>{t('results.no_records')}</Text>
              <Text type="secondary">{t('results.no_records_desc')}</Text>
            </Space>
          }
        />
      )}

      {/* 分页组件 */}
      {state.totalPages > 1 && (
        <Card>
          <Pagination
            current={state.currentPage}
            total={state.totalResults}
            pageSize={state.pageSize}
            onChange={handlePageChange}
            {...createPaginationConfig({
              showSizeChanger: false,
            })}
          />
        </Card>
      )}
    </Space>
  )
}

export default ResultsPage
