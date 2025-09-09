// src/features/questions/browse/pages/QuestionsPage.tsx
import React from 'react'
import { Card, Space, Spin, Typography, Input, Select, Row, Col } from 'antd'
import { useAuth } from '@/shared/contexts/AuthContext'
import { useLanguage } from '@/shared/contexts/LanguageContext'
import { Link } from 'react-router-dom'
import { useQuestionsQuery } from '@/shared/hooks'
import { PageHeader } from '../components/PageHeader'
import { QuestionGrid } from '../components/QuestionGrid'
import { PaginationBar } from '../components/PaginationBar'
import { typeLabel as typeLbl, diffLabel as diffLbl } from '../utils/labelMaps'
import { buildPracticeLink } from '../utils/practiceLink'

const { Title, Text } = Typography

export default function QuestionsPage() {
  const { user, loading: authLoading } = useAuth()
  const { t } = useLanguage()
  const q = useQuestionsQuery(user || null)

  // 本页最简收藏占位（避免与现有 useFavorites 类型不匹配导致 TS 报错）
  const emptyFavSet = React.useMemo(() => new Set<string>(), [])

  // 未登录/加载态
  if (authLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" tip="正在验证登录状态..." />
        <div style={{ minHeight: 200 }} />
      </div>
    )
  }
  if (!user) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 400,
        }}
      >
        <Space direction="vertical" align="center" size="large">
          <Title level={2}>请先登录</Title>
          <Text type="secondary">您需要登录后才能查看题目列表</Text>
          <Link to="/auth/login">
            <span className="ant-btn ant-btn-primary ant-btn-lg">前往登录</span>
          </Link>
        </Space>
      </div>
    )
  }

  // 标题与描述
  const title =
    q.viewType === 'favorites'
      ? '收藏题目'
      : q.viewType === 'wrong'
      ? '错题本'
      : q.viewType === 'browse'
      ? '题目浏览'
      : q.viewType === 'manage'
      ? '题目管理'
      : t('questions.title')
  const desc =
    q.viewType === 'favorites'
      ? '查看您收藏的题目'
      : q.viewType === 'wrong'
      ? '查看您做错的题目'
      : q.viewType === 'browse'
      ? '浏览和练习题目'
      : q.viewType === 'manage'
      ? '管理和维护题目'
      : t('questions.description')

  const practiceHref =
    q.viewType === 'all' && q.items.length > 0
      ? buildPracticeLink(q.items[0].id, {
          type: q.filters.filterType,
          difficulty: q.filters.filterDifficulty,
          search: q.filters.searchTerm,
        })
      : undefined

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <PageHeader
          viewType={q.viewType}
          title={title}
          desc={desc}
          isAdmin={user?.role === 'admin'}
          manageHref="/admin/questions"
          practiceHref={practiceHref}
        />
      </Card>

      {q.viewType === 'all' && (
        <Card>
          {/* 自绘筛选条（避免 @shared/components/FiltersBar 的 props 不兼容） */}
          <Row gutter={[12, 12]} align="middle">
            <Col xs={24} md={10}>
              <Input.Search
                allowClear
                placeholder={t('questions.search_placeholder')}
                value={q.filters.searchTerm}
                onChange={e => q.setSearch(e.target.value)}
                onSearch={v => q.setSearch(v)}
              />
            </Col>
            <Col xs={12} md={7}>
              <Select
                style={{ width: '100%' }}
                value={q.filters.filterType}
                onChange={(v: string) => q.setFilter('type', v)}
                options={Object.entries(typeLbl as any).map(([value, label]) => ({ value, label }))}
              />
            </Col>
            <Col xs={12} md={7}>
              <Select
                style={{ width: '100%' }}
                value={q.filters.filterDifficulty}
                onChange={(v: string) => q.setFilter('difficulty', v)}
                options={Object.entries(diffLbl as any).map(([value, label]) => ({ value, label }))}
              />
            </Col>
          </Row>
        </Card>
      )}

      {q.loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <Spin size="large" tip={t('app.loading_questions')} />
        </div>
      ) : (
        <QuestionGrid
          items={q.items}
          favorites={emptyFavSet} // ✅ 传 Set<string>
          onFavorite={() => {}} // ✅ 占位，无副作用
        />
      )}

      {q.viewType === 'all' && q.items.length > 0 && (
        <PaginationBar
          current={q.pg.currentPage}
          total={q.pg.totalQuestions}
          pageSize={q.pg.pageSize}
          onChange={q.setPage}
          onSizeChange={(_c: number, size: number) => q.setPageSize(size)}
        />
      )}
    </Space>
  )
}
