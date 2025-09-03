import { wrongQuestions } from '@shared/api/http'
import { useAuth } from '@shared/contexts/AuthContext'
import { useLanguage } from '@shared/contexts/LanguageContext'
import { Button, Card, Empty, message, Pagination, Space, Spin, Tag, Typography } from 'antd'
import { BookOpen, CheckCircle, Eye, Filter, RefreshCw, Trash2, TrendingUp, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
const { Title, Text } = Typography

interface WrongQuestion {
  id: number
  user_id: number
  question_id: number
  first_wrong_time: string
  last_practice_time: string
  wrong_count: number
  correct_count: number
  is_mastered: boolean
  notes?: string
  content: string
  question_type: string
  options?: any
  correct_answer?: any
  explanation?: string
  knowledge_points?: string[]
}

interface PracticeStats {
  totalPractice: number
  correctRate: string
  wrongQuestions: number
  masteredQuestions: number
}

export default function WrongQuestionsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t, language } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [wrongQuestionsList, setWrongQuestionsList] = useState<WrongQuestion[]>([])
  const [stats, setStats] = useState<PracticeStats | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filter, setFilter] = useState<'all' | 'unmastered' | 'mastered'>('unmastered')
  const [refreshing, setRefreshing] = useState(false)

  // 加载错题本数据
  const loadWrongQuestions = async (page = 1) => {
    try {
      setLoading(true)
      const mastered = filter === 'all' ? undefined : filter === 'mastered'
      const response = await wrongQuestions.getWrongQuestions({
        page,
        limit: 10,
        mastered,
      })

      if (response.success) {
        setWrongQuestionsList(response.data.wrongQuestions)
        setCurrentPage(response.data.pagination.currentPage)
        setTotalPages(response.data.pagination.totalPages)
      }
    } catch (error) {
      console.error('加载错题本失败:', error)
      message.error('加载错题本失败')
    } finally {
      setLoading(false)
    }
  }

  // 加载练习统计
  const loadStats = async () => {
    try {
      const response = await wrongQuestions.getPracticeStats()
      if (response.success) {
        setStats(response.data)
      }
    } catch (error) {
      console.error('加载统计数据失败:', error)
    }
  }

  // 标记为已掌握
  const handleMarkAsMastered = async (questionId: number) => {
    try {
      await wrongQuestions.markAsMastered(questionId)
      message.success('已标记为掌握')
      loadWrongQuestions(currentPage)
      loadStats()
    } catch (error) {
      console.error('标记掌握失败:', error)
      message.error('操作失败')
    }
  }

  // 从错题本移除
  const handleRemoveFromWrongQuestions = async (questionId: number) => {
    try {
      await wrongQuestions.removeFromWrongQuestions(questionId)
      message.success('已从错题本移除')
      loadWrongQuestions(currentPage)
      loadStats()
    } catch (error) {
      console.error('移除失败:', error)
      message.error('操作失败')
    }
  }

  // 刷新数据
  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([loadWrongQuestions(currentPage), loadStats()])
    setRefreshing(false)
    message.success('数据已刷新')
  }

  // 查看题目详情
  const handleViewQuestion = (questionId: number) => {
    navigate(`/questions/${questionId}`)
  }

  // 获取题目类型标签
  const getQuestionTypeLabel = (type: string) => {
    const typeMap = {
      single_choice: '单选题',
      multiple_choice: '多选题',
      true_false: '判断题',
      short_answer: '简答题',
    }
    return typeMap[type as keyof typeof typeMap] || type
  }

  useEffect(() => {
    loadWrongQuestions(1)
    loadStats()
  }, [filter])

  if (loading && wrongQuestionsList.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <Spin size="large" tip={t('wrongQuestions.loading')}>
          <div style={{ minHeight: '200px', minWidth: '200px' }} />
        </Spin>
      </div>
    )
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%', padding: '24px' }}>
      {/* 页面标题 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Space direction="vertical" size={0}>
          <Title level={1} style={{ margin: 0 }}>
            错题本
          </Title>
          <Text type="secondary">复习错题，巩固知识点</Text>
        </Space>
        <Button
          type="primary"
          onClick={handleRefresh}
          loading={refreshing}
          icon={<RefreshCw style={{ width: 20, height: 20 }} />}
        >
          刷新
        </Button>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Space direction="vertical" size={0}>
                <Text type="secondary">总练习次数</Text>
                <Title level={2} style={{ margin: 0, color: '#262626' }}>
                  {stats.totalPractice}
                </Title>
              </Space>
              <BookOpen style={{ width: 32, height: 32, color: '#1890ff' }} />
            </div>
          </Card>

          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Space direction="vertical" size={0}>
                <Text type="secondary">正确率</Text>
                <Title level={2} style={{ margin: 0, color: '#52c41a' }}>
                  {stats.correctRate}%
                </Title>
              </Space>
              <TrendingUp style={{ width: 32, height: 32, color: '#52c41a' }} />
            </div>
          </Card>

          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Space direction="vertical" size={0}>
                <Text type="secondary">错题数量</Text>
                <Title level={2} style={{ margin: 0, color: '#ff4d4f' }}>
                  {stats.wrongQuestions}
                </Title>
              </Space>
              <XCircle style={{ width: 32, height: 32, color: '#ff4d4f' }} />
            </div>
          </Card>

          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Space direction="vertical" size={0}>
                <Text type="secondary">已掌握</Text>
                <Title level={2} style={{ margin: 0, color: '#1890ff' }}>
                  {stats.masteredQuestions}
                </Title>
              </Space>
              <CheckCircle style={{ width: 32, height: 32, color: '#1890ff' }} />
            </div>
          </Card>
        </div>
      )}

      {/* 筛选器 */}
      <Card>
        <Space align="center">
          <Filter style={{ width: 20, height: 20, color: '#8c8c8c' }} />
          <Text strong>筛选:</Text>
          <Space>
            <Button
              type={filter === 'unmastered' ? 'primary' : 'default'}
              danger={filter === 'unmastered'}
              onClick={() => setFilter('unmastered')}
            >
              未掌握
            </Button>
            <Button
              type={filter === 'mastered' ? 'primary' : 'default'}
              style={filter === 'mastered' ? { backgroundColor: '#52c41a', borderColor: '#52c41a' } : {}}
              onClick={() => setFilter('mastered')}
            >
              已掌握
            </Button>
            <Button type={filter === 'all' ? 'primary' : 'default'} onClick={() => setFilter('all')}>
              全部
            </Button>
          </Space>
        </Space>
      </Card>

      {/* 错题列表 */}
      {wrongQuestionsList.length === 0 ? (
        <Card>
          <Empty
            image={<BookOpen style={{ width: 64, height: 64, color: '#d9d9d9' }} />}
            description={
              <Space direction="vertical">
                <Title level={3} style={{ margin: 0 }}>
                  暂无错题
                </Title>
                <Text type="secondary">
                  {filter === 'unmastered'
                    ? '恭喜！您暂时没有未掌握的错题'
                    : filter === 'mastered'
                    ? '您还没有掌握任何错题'
                    : '您的错题本是空的，开始练习题目吧！'}
                </Text>
              </Space>
            }
          >
            <Button type="primary" onClick={() => navigate('/questions/all')}>
              开始练习
            </Button>
          </Empty>
        </Card>
      ) : (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {wrongQuestionsList.map(item => (
            <Card key={item.id}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ flex: 1 }}>
                  <Space style={{ marginBottom: 12 }}>
                    <Tag color="blue">{getQuestionTypeLabel(item.question_type)}</Tag>
                    <Tag color={item.is_mastered ? 'green' : 'red'}>{item.is_mastered ? '已掌握' : '未掌握'}</Tag>
                  </Space>

                  <div style={{ marginBottom: 12, color: '#262626', lineHeight: '1.5' }}>{item.content}</div>

                  <Space size="large">
                    <Text type="secondary">错误次数: {item.wrong_count}</Text>
                    <Text type="secondary">正确次数: {item.correct_count}</Text>
                    <Text type="secondary">最后练习: {new Date(item.last_practice_time).toLocaleDateString()}</Text>
                  </Space>
                </div>

                <Space style={{ marginLeft: 16 }}>
                  <Button
                    type="text"
                    icon={<Eye style={{ width: 20, height: 20 }} />}
                    onClick={() => handleViewQuestion(item.question_id)}
                    title="查看题目"
                  />

                  {!item.is_mastered && (
                    <Button
                      type="text"
                      icon={<CheckCircle style={{ width: 20, height: 20, color: '#52c41a' }} />}
                      onClick={() => handleMarkAsMastered(item.question_id)}
                      title="标记为已掌握"
                    />
                  )}

                  <Button
                    type="text"
                    danger
                    icon={<Trash2 style={{ width: 20, height: 20 }} />}
                    onClick={() => handleRemoveFromWrongQuestions(item.question_id)}
                    title="从错题本移除"
                  />
                </Space>
              </div>
            </Card>
          ))}
        </Space>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32 }}>
          <Pagination
            current={currentPage}
            total={totalPages * 10}
            pageSize={10}
            onChange={page => loadWrongQuestions(page)}
            showSizeChanger={false}
            showQuickJumper
            showTotal={(total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`}
          />
        </div>
      )}
    </Space>
  )
}
