// apps/web/src/features/wrong-questions/pages/WrongQuestionsPage.tsx

import { Alert, Button, Card, Empty, Segmented, Space, Spin, Typography } from 'antd'
import { BookOpen, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { WrongQuestionItem } from '../components/WrongQuestionItem'
import { useWrongQuestions } from '../hooks/useWrongQuestions'
import GlobalPagination from '@/shared/components/GlobalPagination'
import { translate } from '@/shared/utils/i18n'
const { Title, Text } = Typography

// 小工具：统一中文展示
function StatBox({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="student-wrong-stat">
      <div style={{ fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
    </div>
  )
}

export default function WrongQuestionsPage() {
  const navigate = useNavigate()
  const {
    loading,
    refreshing,
    error,
    statsError,
    pendingIds,
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
        <Spin size="large" tip={translate('app.loading')}>
          <div style={{ minHeight: 200, minWidth: 200 }} />
        </Spin>
      </div>
    )
  }

  // 从 hook 里拿到的 stats 已做兼容归一（accuracy、totalPractices）
  const zhStats = stats && {
    总练习次数: stats.totalPractices ?? 0,
    正确率: `${(stats.accuracy ?? 0).toFixed(1)}%`,
    错题数量: stats.wrongQuestions ?? 0,
    已掌握数量: stats.masteredQuestions ?? 0,
  }

  return (
    <>
   
      <Space className="student-wrong-questions" direction="vertical" size="large" style={{ width: '100%', padding: 8 }}>
        <div className="student-wrong-questions__header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space direction="vertical" size={0}>
            <Title level={2} style={{ margin: 0 }}>
              {translate('menus.learning-wrong')}</Title>
            <Text type="secondary">{translate('auto.34b0ef0ba9')}</Text>
          </Space>
          <Button
            type="primary"
            onClick={refresh}
            loading={refreshing}
            icon={<RefreshCw style={{ width: 20, height: 20 }} />}
          >
            {translate('app.refresh')}</Button>
        </div>

        {/* 统计：中文展示 */}
        {zhStats && (
          <Card>
            <div className="student-wrong-stats">
              <StatBox label={translate('auto.61de46de99')} value={zhStats.总练习次数} />
              <StatBox label={translate('auto.8dc159502e')} value={zhStats.正确率} />
              <StatBox label={translate('auto.44736e6a6b')} value={zhStats.错题数量} />
              <StatBox label={translate('auto.eaadada177')} value={zhStats.已掌握数量} />
            </div>
          </Card>
        )}

        {/* 过滤条 */}
        <Card>
          <Space className="student-wrong-questions__filters" align="center" wrap>
            <div style={{ color: 'var(--ant-color-text-secondary)' }}>{translate('auto.f7c8e8edcf')}</div>
            <Segmented
              value={filter}
              onChange={v => setFilter(v as any)}
              options={[
                { label: translate('auto.74cb412b30'), value: 'unmastered' },
                { label: translate('profile.mastered'), value: 'mastered' },
                { label: translate('auto.778fc8f994'), value: 'all' },
              ]}
            />
          </Space>
        </Card>

        {statsError && <Alert type="warning" showIcon message={statsError} />}
        {error && <Alert type="error" showIcon message="错题暂时无法显示" description={error}
          action={<Button onClick={() => void refresh()} loading={refreshing}>{translate('app.retry')}</Button>} />}

        {/* 列表 */}
        {!error && (list.length === 0 ? (
          <Card>
            <Empty
              image={<BookOpen style={{ width: 64, height: 64, color: '#d9d9d9' }} />}
              description={
                <Space direction="vertical">
                  <Title level={3} style={{ margin: 0 }}>
                    {translate('auto.72f6eaac13')}</Title>
                  <Text type="secondary">
                    {filter === 'unmastered'
                      ? translate('visible.b497d7c79f')
                      : filter === 'mastered'
                      ? translate('visible.559d512525')
                      : translate('visible.6d5c2bebb2')}
                  </Text>
                </Space>
              }
            >
              <Button type="primary" onClick={() => navigate('/learning/practice')}>
                {translate('auto.5c007a10e6')}</Button>
            </Empty>
          </Card>
        ) : (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {list.map(item => (
              <WrongQuestionItem
                key={item.question_id ?? (item as any).id}
                item={item}
                busy={pendingIds.has(item.question_id)}
                onView={qid => navigate(`/questions/${qid}/practice`)}
                onMark={markMastered}
                onRemove={remove}
              />
            ))}
          </Space>
        ))}

        {totalPages > 1 && (
          <GlobalPagination
            total={total}
            current={page}
            pageSize={pageSize}
            onChange={p => onPageChange(p)}
            showSizeChanger={false}
          />
        )}
      </Space>
    </>
  )
}
