import { Card } from 'antd'
import { translate } from '@/shared/utils/i18n'

export default function PaperQuestionList({ questions }: { questions: any[] }) {
  return (
    <Card title={translate('auto.471b31d45a')} style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {questions.map((q, i) => (
          <div key={q.id ?? i} style={{ padding: 16, border: '1px solid #d9d9d9', borderRadius: 6 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ fontWeight: 500 }}>{i + 1}.</div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, marginBottom: 8, fontWeight: 500 }}>
                  {q.question_content ?? q.content ?? translate('visible.4464621127')}
                </h3>
                <div style={{ display: 'flex', gap: 16, color: '#666', fontSize: 14 }}>
                  <span>{translate('auto.fe5230eabe')}{q.question_type ?? q.type ?? '-'}</span>
                  <span>{translate('auto.494e3c003c')}{q.score ?? '-'}{translate('papers.addon_score')}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
        {questions.length === 0 && <div style={{ color: '#999' }}>{translate('questions.empty')}</div>}
      </div>
    </Card>
  )
}
