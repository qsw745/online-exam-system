// features/questions/practice/pages/QuestionPracticePage.tsx
import { Card, Space, Spin, Tag, Typography, message } from 'antd'
import { useEffect } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { PracticeHeader } from '../components/PracticeHeader'
import { OptionsList } from '../components/OptionsList'
import { ShortAnswerBox } from '../components/ShortAnswerBox'
import { PracticeFooter } from '../components/PracticeFooter'
import { ExplanationCard } from '../components/ExplanationCard'
import { KnowledgePointsCard } from '../components/KnowledgePointsCard'
import { usePracticeController } from '../hooks/usePracticeController'
import { useAnswerState } from '../hooks/useAnswerState'
import { difficultyLabel, typeLabel } from '../utils/answer'
import { buildContinuousQuery, parseFilters } from '../utils/url'
const { Title, Text } = Typography

export default function QuestionPracticePage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()

  const ctrl = usePracticeController()
  const as = useAnswerState()

  // 解析 URL -> 初始化/加载
  useEffect(() => {
    const { mode, filters } = parseFilters(location.search)
    if (mode === 'continuous') {
      ctrl.initContinuous(filters, id).then(firstId => {
        if (firstId && firstId !== id) {
          navigate(`/questions/${firstId}/practice?${buildContinuousQuery(filters)}`, { replace: true })
        } else if (id) {
          ctrl.loadQuestion(id)
        }
      })
    } else {
      ctrl.loadQuestion(id!)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, id])

  // 新题目加载后，重置作答
  useEffect(() => {
    as.reset()
  }, [ctrl.question]) // 只在题目改变时重置

  // 头部导航
  const goNext = () => {
    if (ctrl.mode !== 'continuous') return
    const nextIdx = ctrl.index + 1
    if (nextIdx < ctrl.ids.length) {
      const nextId = ctrl.ids[nextIdx]
      const qs = buildContinuousQuery(ctrl.filters)
      navigate(`/questions/${nextId}/practice?${qs}`, { replace: true })
      ctrl.setIndex(nextIdx)
    } else {
      message.success('恭喜！您已完成所有题目练习')
      navigate('/questions/all')
    }
  }
  const goPrev = () => {
    if (ctrl.mode !== 'continuous') return
    const prevIdx = ctrl.index - 1
    if (prevIdx >= 0) {
      const prevId = ctrl.ids[prevIdx]
      const qs = buildContinuousQuery(ctrl.filters)
      navigate(`/questions/${prevId}/practice?${qs}`, { replace: true })
      ctrl.setIndex(prevIdx)
    }
  }

  // 加载态/错误态
  if (ctrl.loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    )
  }
  if (ctrl.error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', padding: 20 }}>
        <Space direction="vertical" align="center">
          <Title level={2}>题目不存在</Title>
          <Text type="secondary">{ctrl.error}</Text>
        </Space>
      </div>
    )
  }
  const q = ctrl.question
  if (!q) return null

  const canSubmit =
    (q.type === 'short_answer' && as.text.trim() !== '') || (q.type !== 'short_answer' && as.selected.length > 0)

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <PracticeHeader
          onBack={() => navigate('/questions/all')}
          mode={ctrl.mode}
          index={ctrl.index}
          total={ctrl.ids.length}
          onPrev={goPrev}
          onNext={goNext}
          onSkip={goNext}
          canPrev={ctrl.index > 0}
          canNext={ctrl.index < ctrl.ids.length - 1}
          favorited={ctrl.favorited}
          onToggleFavorite={ctrl.toggleFavorite}
          showExplanation={as.showExp}
          onToggleExplanation={() => as.setShowExp(!as.showExp)}
        />

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Space>
              <Tag color="blue">{typeLabel(q.type)}</Tag>
              {q.difficulty && (
                <Tag color={q.difficulty === 'easy' ? 'green' : q.difficulty === 'medium' ? 'orange' : 'red'}>
                  {difficultyLabel(q.difficulty)}
                </Tag>
              )}
            </Space>
            {as.answered && <Tag color={as.correct ? 'success' : 'error'}>{as.correct ? '回答正确' : '回答错误'}</Tag>}
          </div>

          <div style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.6 }}>{q.content}</Text>
          </div>

          {(q.type === 'single_choice' || q.type === 'multiple_choice' || q.type === 'true_false') && (
            <OptionsList
              multiple={q.type === 'multiple_choice'}
              options={q.options}
              selected={as.selected}
              correctIndices={q.correctIndices}
              answered={as.answered}
              onChange={idx => as.choose(q, idx)}
            />
          )}

          {q.type === 'short_answer' && <ShortAnswerBox value={as.text} onChange={as.setText} disabled={as.answered} />}

          <PracticeFooter
            mode={ctrl.mode}
            canSubmit={canSubmit}
            answered={as.answered}
            onSubmit={() => {
              const ok = as.submit(q)
              ctrl.record(q.id, ok, q.type === 'short_answer' ? as.text : as.selected)
            }}
            onRetry={as.reset}
            onNext={goNext}
            isLast={ctrl.index === ctrl.ids.length - 1}
          />
        </Card>

        {as.showExp && <ExplanationCard text={q.explanation} />}
        <KnowledgePointsCard points={q.knowledgePoints} />
      </Space>
    </div>
  )
}
