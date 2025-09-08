// src/features/wrong-questions/pages/WrongQuestionsPage.tsx
import { Button, Empty, Pagination, Space, Spin, Typography, Card, Segmented } from 'antd'
import { RefreshCw, BookOpen } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useWrongQuestions } from '../hooks/useWrongQuestions'
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

      {/* 简单统计展示（避免 StatsCard props 不匹配） */}
      {stats && (
        <Card>
          <Space size="large" wrap>
            {Object.entries(stats).map(([k, v]) => (
              <div key={k} style={{ minWidth: 120 }}>
                <div style={{ fontSize: 12, color: '#999' }}>{k}</div>
                <div style={{ fontSize: 22, fontWeight: 600 }}>{String(v)}</div>
              </div>
            ))}
          </Space>
        </Card>
      )}

      {/* 过滤条（避免 FiltersBar 泛型不匹配） */}
      <Card>
        <Space align="center">
          <div style={{ color: '#666' }}>筛选：</div>
          <Segmented
            value={filter}
            onChange={v => setFilter(v as any)}
            options={[
              { label: '未掌握', value: 'unmastered' },
              { label: '已掌握', value: 'mastered' },
              { label: '全部', value: 'all' },
            ]}
          />
        </Space>
      </Card>

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
