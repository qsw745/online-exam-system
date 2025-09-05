import { Button } from 'antd'
import type { Question } from '../endpoints/questions'

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
            <span>类型: {q.type}</span>
            <span>难度: {q.difficulty}</span>
            <span>分值: {q.score}分</span>
          </div>
          {q.knowledge_points?.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {q.knowledge_points.map((p, i) => (
                <span key={i} style={{ padding: '2px 8px', borderRadius: 12, background: '#f5f5f5', fontSize: 12 }}>
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>
        <Button type={selected ? 'primary' : 'default'} danger={selected} size="small" onClick={onToggle}>
          {selected ? '移除' : '添加'}
        </Button>
      </div>
    </div>
  )
}
