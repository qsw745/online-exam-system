import { PaginationBar } from '@/features/questions/browse/components/PaginationBar'
import BulkPracticeView from '@/features/questions/practice/components/BulkPracticeView'
import PracticeFilters from '@/features/questions/practice/components/PracticeFilters'
import QuestionCardGrid from '@/features/questions/practice/components/QuestionCardGrid'
import SinglePracticeView from '@/features/questions/practice/components/SinglePracticeView'
import { usePracticeList } from '@/features/questions/practice/hooks/usePracticeList'

import { useLanguage } from '@/shared/contexts/LanguageContext'
import { Card, Space, Typography } from 'antd'
import { useMemo, useState } from 'react'
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

    /** ✅ 多选题型 */
    types,
    setTypes,

    difficulty,
    search,
    selectedTags,
    allTags,

    setDifficulty,
    setSearch,
    setSelectedTags,
    setPage,
    setPageSize,
  } = usePracticeList()

  const [view, setView] = useState<View>('list')
  const [startIndex, setStartIndex] = useState(0)
  const ids = useMemo(() => list.map(it => String(it.id)), [list])

  return (
    <>
      {view === 'list' && (
        <div style={{ minWidth: 1200, margin: '0 auto' }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Card>
              <Title level={3} style={{ margin: 0 }}>
                题目练习
              </Title>
              <Text type="secondary">{t('questions.search_placeholder')}</Text>
            </Card>

            <PracticeFilters
              /** ✅ 多选题型传入/传出 */
              types={types}
              difficulty={difficulty}
              search={search}
              selectedTags={selectedTags}
              allTags={allTags}
              onTypesChange={v => {
                setTypes(v)
                setPage(1)
              }}
              onDifficultyChange={d => {
                setDifficulty(d)
                setPage(1)
              }}
              onSearch={kw => {
                setPage(1)
                setSearch(kw)
              }}
              onTagsChange={tags => {
                setSelectedTags(tags)
                setPage(1)
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
                setView('single')
              }}
            />

            <PaginationBar
              current={page}
              pageSize={pageSize}
              total={total}
              onChange={(p: number) => setPage(p)}
              onSizeChange={(c: number, s: number) => {
                setPage(c)
                setPageSize(s)
              }}
            />
          </Space>
        </div>
      )}

      {view === 'single' && (
        <SinglePracticeView
          key={`single-${page}-${pageSize}`}
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
