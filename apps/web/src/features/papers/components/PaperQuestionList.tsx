import { Card } from 'antd'

export default function PaperQuestionList({ questions }: { questions: any[] }) {
  return (
    <Card title="试卷题目" style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {questions.map((q, i) => (
          <div key={q.id ?? i} style={{ padding: 16, border: '1px solid #d9d9d9', borderRadius: 6 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ fontWeight: 500 }}>{i + 1}.</div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, marginBottom: 8, fontWeight: 500 }}>
                  {q.question_content ?? q.content ?? '（无题干）'}
                </h3>
                <div style={{ display: 'flex', gap: 16, color: '#666', fontSize: 14 }}>
                  <span>类型: {q.question_type ?? q.type ?? '-'}</span>
                  <span>分值: {q.score ?? '-'}分</span>
                </div>
              </div>
            </div>
          </div>
        ))}
        {questions.length === 0 && <div style={{ color: '#999' }}>暂无题目</div>}
      </div>
    </Card>
  )
}
