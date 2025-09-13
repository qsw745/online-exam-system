// src/features/questions/pages/QuestionPracticePage.tsx
import BulkPracticeView from '@/features/questions/practice/components/BulkPracticeView'
import PracticeFilters from '@/features/questions/practice/components/PracticeFilters'
import QuestionCardGrid from '@/features/questions/practice/components/QuestionCardGrid'
import SinglePracticeView from '@/features/questions/practice/components/SinglePracticeView'
import { usePracticeList } from '@/features/questions/practice/hooks/usePracticeList'
import { useLanguage } from '@/shared/contexts/LanguageContext'
import { Card, Space, Typography } from 'antd'
import { useMemo, useState } from 'react'
// ✅ 使用公共分页条（已封装）
import { PaginationBar } from '@/features/questions/browse/components/PaginationBar'

const { Title, Text } = Typography

type View = 'list' | 'single' | 'bulk'

export default function QuestionPracticePage() {
  const { t } = useLanguage()
  const {
    list,
    total,
    page,
    pageSize,
    loading,
    type,
    difficulty,
    search,
    setType,
    setDifficulty,
    setSearch,
    setPage,
    setPageSize,
  } = usePracticeList()

  const [view, setView] = useState<View>('list')
  const [startIndex, setStartIndex] = useState(0)
  const ids = useMemo(() => list.map(it => String(it.id)), [list])

  return (
    <>
      {view === 'list' && (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Card>
              <Title level={3} style={{ margin: 0 }}>
                题目练习
              </Title>
              <Text type="secondary">{t('questions.search_placeholder')}</Text>
            </Card>

            <PracticeFilters
              type={type}
              difficulty={difficulty}
              search={search}
              onTypeChange={setType}
              onDifficultyChange={setDifficulty}
              onSearch={val => {
                setPage(1)
                setSearch(val)
              }}
              onEnterSingle={idx => {
                setStartIndex(idx)
                setView('single')
              }}
              onEnterBulk={() => setView('bulk')}
            />

            <QuestionCardGrid
              loading={loading}
              list={list}
              onCardClick={idx => {
                setStartIndex(idx)
                // 进入方式由 PracticeFilters 上的模式按钮决定：
                // 直接交给 filter 里的 onEnterSingle / onEnterBulk 调用。
                // 这里默认仍按单题进入，避免“多题模式没有反应”的困惑：
                setView('single')
              }}
            />

            <PaginationBar
              current={page}
              pageSize={pageSize}
              total={total}
              onChange={(p: number, s: number) => {
                setPage(p)
                setPageSize(s)
              }}
              showSizeChanger
              showQuickJumper
            />
          </Space>
        </div>
      )}

      {view === 'single' && (
        <SinglePracticeView
          key={`single-${page}-${pageSize}`} // 切页重置内部状态
          ids={ids}
          startIndex={startIndex}
          onExit={() => setView('list')}
        />
      )}

      {view === 'bulk' && (
        <BulkPracticeView key={`bulk-${page}-${pageSize}`} ids={ids} onExit={() => setView('list')} />
      )}
    </>
  )
}
