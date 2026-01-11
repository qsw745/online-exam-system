// src/features/questions/browse/pages/QuestionsPage.tsx
import { useQuestionsQuery } from '@/features/questions/hooks/useQuestionsQuery'
import { useAuth } from '@/shared/contexts/AuthContext'
import { useLanguage } from '@/shared/contexts/LanguageContext'
import { Card, Col, Input, Row, Select, Space, Spin, Typography } from 'antd'
import React from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import GlobalPagination from '@/shared/components/GlobalPagination'
import { QuestionGrid } from '../components/QuestionGrid'
import { diffLabel as diffLbl, typeLabel as typeLbl } from '../utils/labelMaps'
import { buildPracticeLink } from '../utils/practiceLink'
const { Title, Text } = Typography

export default function QuestionsPage() {
  const { user, loading: authLoading } = useAuth()
  const { t } = useLanguage()
  const uid = Number((user as any)?.id)
  const q = useQuestionsQuery(Number.isFinite(uid) ? { id: uid } : null)

  const emptyFavSet = React.useMemo(() => new Set<string>(), [])

  if (authLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" tip="正在验证登录状态..." spinning>
          <div style={{ width: 1, height: 1 }} />
        </Spin>
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
          <Link to="/login">
            <span className="ant-btn ant-btn-primary ant-btn-lg">前往登录</span>
          </Link>
        </Space>
      </div>
    )
  }

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

  // ✅ 练习入口链接：只带筛选参数，不带题目 id
  const practiceHref =
    q.viewType === 'all'
      ? buildPracticeLink({
          type: q.filters.type,
          difficulty: q.filters.difficulty,
          search: q.filters.search,
        })
      : undefined

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <PageHeader
          viewType={q.viewType}
          title={title}
          desc={desc}
          practiceHref={practiceHref}
        />
      </Card>

      {q.viewType === 'all' && (
        <Card>
          <Row gutter={[12, 12]} align="middle">
            <Col xs={24} md={10}>
              <Input.Search
                allowClear
                placeholder={t('questions.search_placeholder')}
                value={q.filters.search}
                onChange={e => q.setSearch(e.target.value)}
                onSearch={v => q.setSearch(v, { immediate: true })}
              />
            </Col>
            <Col xs={12} md={7}>
              <Select
                style={{ width: '100%' }}
                value={q.filters.type}
                onChange={(v: string) => q.setFilter('type', v)}
                options={Object.entries(typeLbl as Record<string, string>).map(([value, label]) => ({ value, label }))}
              />
            </Col>
            <Col xs={12} md={7}>
              <Select
                style={{ width: '100%' }}
                value={q.filters.difficulty}
                onChange={(v: string) => q.setFilter('difficulty', v)}
                options={Object.entries(diffLbl as Record<string, string>).map(([value, label]) => ({ value, label }))}
              />
            </Col>
          </Row>
        </Card>
      )}

      <Spin spinning={q.loading} size="large" tip={t('app.loading_questions')}>
        <div style={{ minHeight: 400 }}>
          <QuestionGrid items={q.items} favorites={emptyFavSet} onFavorite={() => {}} />
        </div>
      </Spin>

      {q.viewType === 'all' && q.items.length > 0 && (
        <GlobalPagination
          current={q.page}
          total={q.total}
          pageSize={q.pageSize}
          onChange={(p, size) => {
            q.setPage(p)
            q.setPageSize(size)
          }}
        />
      )}
    </Space>
  )
}
