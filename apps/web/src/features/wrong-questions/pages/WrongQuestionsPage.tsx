// features/wrong-questions/pages/WrongQuestionsPage.tsx
import { Button, Empty, Pagination, Space, Spin, Typography, Card } from 'antd'
import { RefreshCw, BookOpen } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useWrongQuestions } from '../hooks/useWrongQuestions'
import { StatsCards } from '../components/StatsCards'
import { FilterBar } from '../components/FilterBar'
import { WrongQuestionItem } from '../components/WrongQuestionItem'
const { Title, Text } = Typography

export default function WrongQuestionsPage() {
  const navigate = useNavigate()
  const {
    loading,
    refreshing,
    filter,
    list,
    stats,
    page,
    pageSize,
    total,
    totalPages,
    setFilter,
    refresh,
    markMastered,
    remove,
    onPageChange,
  } = useWrongQuestions('unmastered')

  if (loading && list.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <Spin size="large" tip="加载中...">
          <div style={{ minHeight: 200, minWidth: 200 }} />
        </Spin>
      </div>
    )
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Space direction="vertical" size={0}>
          <Title level={1} style={{ margin: 0 }}>
            错题本
          </Title>
          <Text type="secondary">复习错题，巩固知识点</Text>
        </Space>
        <Button
          type="primary"
          onClick={refresh}
          loading={refreshing}
          icon={<RefreshCw style={{ width: 20, height: 20 }} />}
        >
          刷新
        </Button>
      </div>

      {stats && <StatsCards stats={stats} />}

      <FilterBar value={filter} onChange={setFilter} />

      {/* 列表 */}
      {list.length === 0 ? (
        <Card>
          <Empty
            image={<BookOpen style={{ width: 64, height: 64, color: '#d9d9d9' }} />}
            description={
              <Space direction="vertical">
                <Title level={3} style={{ margin: 0 }}>
                  暂时没有符合条件的错题
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
          {list.map(item => (
            <WrongQuestionItem
              key={item.id}
              item={item}
              onView={qid => navigate(`/questions/${qid}`)}
              onMark={markMastered}
              onRemove={remove}
            />
          ))}
        </Space>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32 }}>
          <Pagination
            current={page}
            total={total}
            pageSize={pageSize}
            onChange={onPageChange}
            showSizeChanger={false}
            showQuickJumper
            showTotal={(t, r) => `第 ${r[0]}-${r[1]} 条，共 ${t} 条`}
          />
        </div>
      )}
    </Space>
  )
}
