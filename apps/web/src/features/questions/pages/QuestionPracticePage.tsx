import GlobalPagination from '@/shared/components/GlobalPagination'
import BulkPracticeView from '@/features/questions/practice/components/BulkPracticeView'
import PracticeFilters from '@/features/questions/practice/components/PracticeFilters'
import QuestionCardGrid from '@/features/questions/practice/components/QuestionCardGrid'
import SinglePracticeView from '@/features/questions/practice/components/SinglePracticeView'
import { usePracticeList } from '@/features/questions/practice/hooks/usePracticeList'

import { useLanguage } from '@/shared/contexts/LanguageContext'
import { Card, Space, Typography } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
const { Title, Text } = Typography
type View = 'list' | 'single' | 'bulk'

const STORAGE_KEY = 'learning:practice:view-state'

type PersistedState = {
  view: View
  ids: string[]
  index: number
  ts?: number
}

const clampIndex = (idx: number, total: number) => {
  if (!total) return 0
  const safe = Number.isFinite(idx) ? idx : 0
  return Math.max(0, Math.min(total - 1, safe))
}

const readPersistedState = (): PersistedState | null => {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedState
    if (!parsed || parsed.view === 'list') return null
    if (!Array.isArray(parsed.ids) || !parsed.ids.length) return null
    return {
      view: parsed.view,
      ids: parsed.ids.map(id => String(id)),
      index: clampIndex(parsed.index ?? 0, parsed.ids.length),
      ts: parsed.ts,
    }
  } catch {
    return null
  }
}

const persistState = (state: PersistedState | null) => {
  if (typeof window === 'undefined') return
  try {
    if (!state || state.view === 'list' || !state.ids.length) {
      sessionStorage.removeItem(STORAGE_KEY)
      return
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, ts: Date.now() }))
  } catch {
    /* ignore */
  }
}

export default function QuestionPracticePage() {
  const { id: routeQuestionId } = useParams<{ id?: string }>()
  const navigate = useNavigate()
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
  const [practiceIds, setPracticeIds] = useState<string[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const ids = useMemo(() => list.map(it => String(it.id)), [list])
  const activeIds = practiceIds.length ? practiceIds : ids

  const enterSingle = (idx: number) => {
    const snapshot = ids.length ? ids : practiceIds
    if (!snapshot.length) return
    const nextIdx = clampIndex(idx, snapshot.length)
    setPracticeIds(snapshot)
    setActiveIndex(nextIdx)
    setView('single')
  }

  const enterBulk = () => {
    const snapshot = ids.length ? ids : practiceIds
    if (!snapshot.length) return
    setPracticeIds(snapshot)
    setActiveIndex(0)
    setView('bulk')
  }

  const exitPractice = () => {
    setView('list')
    setPracticeIds([])
    setActiveIndex(0)
    if (routeQuestionId) navigate('/learning/practice', { replace: true })
  }

  useEffect(() => {
    const persisted = readPersistedState()
    if (!persisted) return
    setPracticeIds(persisted.ids)
    setActiveIndex(clampIndex(persisted.index ?? 0, persisted.ids.length))
    setView(persisted.view)
  }, [])

  useEffect(() => {
    if (!routeQuestionId) return
    const qid = String(routeQuestionId)
    setPracticeIds([qid])
    setActiveIndex(0)
    setView('single')
  }, [routeQuestionId])

  useEffect(() => {
    if (view === 'list') {
      persistState(null)
      return
    }
    persistState({ view, ids: practiceIds, index: clampIndex(activeIndex, practiceIds.length) })
  }, [view, practiceIds, activeIndex])

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
              onEnterSingle={enterSingle}
              onEnterBulk={enterBulk}
            />

            <QuestionCardGrid
              loading={loading}
              list={list}
              onCardClick={enterSingle}
            />

            <GlobalPagination
              current={page}
              pageSize={pageSize}
              total={total}
              onChange={(p, size) => {
                setPage(p)
                setPageSize(size)
              }}
            />
          </Space>
        </div>
      )}

      {view === 'single' && (
        <SinglePracticeView
          key={`single-${page}-${pageSize}`}
          ids={activeIds}
          startIndex={activeIndex}
          onIndexChange={setActiveIndex}
          onExit={exitPractice}
        />
      )}

      {view === 'bulk' && (
        <BulkPracticeView key={`bulk-${page}-${pageSize}`} ids={activeIds} onExit={exitPractice} />
      )}
    </>
  )
}
