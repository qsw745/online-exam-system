// src/features/papers/components/QuestionCard.tsx
import { Button } from 'antd'
import { translate } from '@/shared/utils/i18n'

// 最小问题类型，避免依赖不存在的 ../endpoints/questions
export interface Question {
  id: string
  content?: string
  type?: string
  difficulty?: string
  score?: number
  knowledge_points?: string[]
  [k: string]: any
}

export default function QuestionCard({
  q,
  selected,
  onToggle,
}: {
  q: Question
  selected: boolean
  onToggle: () => void
}) {
  return (
    <div
      style={{
        padding: 16,
        border: `1px solid ${selected ? '#1677ff' : '#d9d9d9'}`,
        borderRadius: 8,
        background: selected ? '#f0f8ff' : '#fff',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, marginBottom: 8, fontWeight: 500 }}>{q.content}</h3>
          <div style={{ display: 'flex', gap: 16, color: '#666' }}>
            <span>{translate('auto.fe5230eabe')}{q.type}</span>
            <span>{translate('auto.26c8931f6f')}{q.difficulty}</span>
            <span>{translate('auto.494e3c003c')}{q.score}{translate('papers.addon_score')}</span>
          </div>
          {Array.isArray(q.knowledge_points) && q.knowledge_points.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {q.knowledge_points.map((p: string, i: number) => (
                <span key={i} style={{ padding: '2px 8px', borderRadius: 12, background: '#f5f5f5', fontSize: 12 }}>
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>
        <Button type={selected ? 'primary' : 'default'} danger={selected} size="small" onClick={onToggle}>
          {selected ? translate('papers.op_remove') : translate('app.add')}
        </Button>
      </div>
    </div>
  )
}
