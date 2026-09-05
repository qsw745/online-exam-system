import GlobalPagination from '@/shared/components/GlobalPagination'
import BulkPracticeView from '@/features/questions/practice/components/BulkPracticeView'
import PracticeFilters from '@/features/questions/practice/components/PracticeFilters'
import QuestionCardGrid from '@/features/questions/practice/components/QuestionCardGrid'
import SinglePracticeView from '@/features/questions/practice/components/SinglePracticeView'
import { usePracticeList } from '@/features/questions/practice/hooks/usePracticeList'

import { useLanguage } from '@/shared/contexts/LanguageContext'
import { App, Alert, Button, Card, Empty, Space, Typography } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/shared/contexts/AuthContext'
import { translate } from '@/shared/utils/i18n'
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
  return Math.max(0, Math.min(total - 1, Math.floor(safe)))
}

const readPersistedState = (key: string): PersistedState | null => {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedState
    if (!parsed || !['single', 'bulk'].includes(parsed.view)) return null
    if (!Array.isArray(parsed.ids) || !parsed.ids.length || parsed.ids.some(id => !/^[1-9]\d*$/.test(String(id)))) return null
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

const persistState = (key: string, state: PersistedState | null) => {
  if (typeof window === 'undefined') return
  try {
    if (!state || state.view === 'list' || !state.ids.length) {
      sessionStorage.removeItem(key)
      return
    }
    sessionStorage.setItem(key, JSON.stringify({ ...state, ts: Date.now() }))
  } catch {
    /* ignore */
  }
}

export default function QuestionPracticePage() {
  const { id } = useParams<{ id?: string }>()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  return <PracticePageContent key={`${user?.id}:${id ?? ''}:${searchParams.get('taskId') ?? ''}`} />
}

function PracticePageContent() {
  const { id: routeQuestionId } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fromTask = searchParams.has('taskId')
  const { user } = useAuth()
  const storageKey = `${STORAGE_KEY}:${user?.id ?? 'anonymous'}`
  const { t } = useLanguage()
  const { message } = App.useApp()
  const {
    list,
    total,
    page,
    pageSize,
    loading,
    error,
    refetch,
    loadedPage,

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

  const [initialState] = useState(() => fromTask || routeQuestionId ? null : readPersistedState(storageKey))
  const [view, setView] = useState<View>(() => routeQuestionId ? 'single' : initialState?.view ?? 'list')
  const [practiceIds, setPracticeIds] = useState<string[]>(() => routeQuestionId ? [routeQuestionId] : initialState?.ids ?? [])
  const [activeIndex, setActiveIndex] = useState(initialState?.index ?? 0)
  const [advancing, setAdvancing] = useState(false)
  const ids = useMemo(() => list.map(it => String(it.id)), [list])
  const activeIds = practiceIds.length ? practiceIds : ids
  const canAdvancePage = view === 'single' && !routeQuestionId && practiceIds.length > 0 && practiceIds.length === ids.length && practiceIds.every((id, index) => id === ids[index])
  const hasNextPage = canAdvancePage && page * pageSize < total

  const enterSingle = (idx: number) => {
    if (loading || error) return
    const snapshot = ids.length ? ids : practiceIds
    if (!snapshot.length) return
    const nextIdx = clampIndex(idx, snapshot.length)
    setPracticeIds(snapshot)
    setActiveIndex(nextIdx)
    setView('single')
  }

  const enterBulk = () => {
    if (loading || error) return
    const snapshot = ids.length ? ids : practiceIds
    if (!snapshot.length) return
    setPracticeIds(snapshot)
    setActiveIndex(0)
    setView('bulk')
  }

  const exitPractice = () => {
    persistState(storageKey, null)
    setView('list')
    setPracticeIds([])
    setActiveIndex(0)
    setAdvancing(false)
    if (routeQuestionId) navigate('/learning/practice', { replace: true })
  }

  useEffect(() => {
    if (!routeQuestionId) return
    const qid = String(routeQuestionId)
    setPracticeIds([qid])
    setActiveIndex(0)
    setView('single')
  }, [routeQuestionId])

  useEffect(() => {
    if (view === 'list') {
      persistState(storageKey, null)
      return
    }
    persistState(storageKey, { view, ids: practiceIds, index: clampIndex(activeIndex, practiceIds.length) })
  }, [view, practiceIds, activeIndex, storageKey])

  useEffect(() => {
    if (!advancing || loading || error || loadedPage !== page || view !== 'single') return
    if (!ids.length) {
      setAdvancing(false)
      message.info(translate('auto.89e9e4736e'))
      exitPractice()
      return
    }
    setAdvancing(false)
    setPracticeIds(ids)
    setActiveIndex(0)
  }, [ids, message, view, advancing, loading, error, loadedPage, page])

  const requestNextPage = () => {
    if (!hasNextPage || advancing || loading) return false
    setAdvancing(true)
    setPage(p => p + 1)
    return true
  }

  return (
    <>
      {error && <Alert type="error" showIcon message="练习题暂时无法显示" description={error}
        style={{ marginBottom: 16 }} action={<Button onClick={refetch}>{translate('app.retry')}</Button>} />}
      {view === 'list' && (
        <div className="student-practice-page">
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Card>
              <Title level={3} style={{ margin: 0 }}>
                {translate('menus.learning-practice')}</Title>
              <Text type="secondary">{t('questions.search_placeholder')}</Text>
            </Card>

            <PracticeFilters
              disabled={loading || !!error || !list.length}
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

            {!loading && !error && !list.length && <Card><Empty description="没有符合条件的题目，请调整筛选条件" /></Card>}
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
          navigationBusy={advancing}
          ids={activeIds}
          startIndex={activeIndex}
          onIndexChange={setActiveIndex}
          onExit={exitPractice}
          hasNextPage={hasNextPage}
          onNextPage={requestNextPage}
        />
      )}

      {view === 'bulk' && (
        <BulkPracticeView key={`bulk-${activeIds.join(",")}`} ids={activeIds} onExit={exitPractice} />
      )}
    </>
  )
}
