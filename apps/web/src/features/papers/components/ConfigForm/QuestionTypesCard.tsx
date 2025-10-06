// features/smart-paper/components/ConfigForm/QuestionTypesCard.tsx
import { Card, Form, Input } from 'antd'
import type { SmartPaperConfig } from '../../../../shared/api/endpoints/smartPaper'

export default function QuestionTypesCard({
  config,
  setQType,
}: {
  config: SmartPaperConfig
  setQType: (k: keyof SmartPaperConfig['questionTypes'], v: number) => void
}) {
  const q = config.questionTypes
  return (
    <Card title="题目配置" className="mb-6">
      <Form layout="vertical">
        <Form.Item label="题目总数">
          <Input
            type="number"
            min={1}
            value={config.totalQuestions}
            onChange={e => {
              // 保持现有布局逻辑（如需真正更新 totalQuestions，应由上层提供 setter）
              setQType('single_choice' as any, q.single_choice)
            }}
          />
        </Form.Item>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ['single_choice', '单选题'],
              ['multiple_choice', '多选题'],
              ['true_false', '判断题'],
              ['fill_blank', '填空题'],
              ['essay', '主观题'],
            ] as const
          ).map(([k, label]) => (
            <div key={k}>
              <div className="text-sm mb-1">{label}</div>
              <Input type="number" min={0} value={q[k]} onChange={e => setQType(k, parseInt(e.target.value) || 0)} />
            </div>
          ))}
        </div>
      </Form>
    </Card>
  )
}
