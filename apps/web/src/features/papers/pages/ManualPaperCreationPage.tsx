
import { Card, Spin } from 'antd'
import { useManualPaper } from '../../../shared/hooks/useManualPaper'
import PaperInfoForm from '../components/PaperInfoForm'
import QuestionCard from '../components/QuestionCard'
import QuestionFilters from '../components/QuestionFilters'
export default function ManualPaperCreationPage() {
  const h = useManualPaper()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
  
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>手动组卷</h1>
        <p style={{ color: '#666', margin: 0 }}>从题库中选择题目创建试卷</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        {/* 左侧：题目列表 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="题目列表">
            <div style={{ display: 'flex', marginBottom: 16 }}>
              <QuestionFilters
                keyword={h.keyword}
                onKeywordChange={h.setKeyword}
                type={h.type}
                onTypeChange={h.setType}
                difficulty={h.difficultyFilter}
                onDifficultyChange={h.setDifficultyFilter}
              />
            </div>

            <Spin spinning={h.loading}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {h.questions.map(q => (
                  <QuestionCard
                    key={q.id}
                    q={q}
                    selected={h.selectedIds.has(q.id)}
                    onToggle={() => h.toggleSelect(q.id)}
                  />
                ))}
              </div>
            </Spin>
          </Card>
        </div>

        {/* 右侧：试卷信息 */}
        <Card title="试卷信息">
          <PaperInfoForm
            title={h.title}
            description={h.description}
            duration={h.duration}
            difficulty={h.difficulty}
            totalScore={h.totalScore}
            selectedCount={h.selectedIds.size}
            submitting={h.loading}
            onChange={patch => {
              if (patch.title !== undefined) h.setTitle(patch.title)
              if (patch.description !== undefined) h.setDescription(patch.description)
              if (patch.duration !== undefined) h.setDuration(patch.duration)
              if (patch.difficulty !== undefined) h.setDifficulty(patch.difficulty)
            }}
            onSubmit={h.createPaper}
          />
        </Card>
      </div>
    </div>
  )
}
