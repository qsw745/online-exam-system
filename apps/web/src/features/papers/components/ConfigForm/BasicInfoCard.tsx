// features/smart-paper/components/ConfigForm/BasicInfoCard.tsx
import { Card, Form, Input, Select } from 'antd'
import type { SmartPaperConfig } from '../../../../shared/api/endpoints/smartPaper'
const { TextArea } = Input

export default function BasicInfoCard({
  config,
  setField,
}: {
  config: SmartPaperConfig
  setField: <K extends keyof SmartPaperConfig>(k: K, v: SmartPaperConfig[K]) => void
}) {
  return (
    <Card title="基本信息" className="mb-6">
      <Form layout="vertical">
        <Form.Item label="试卷标题" required>
          <Input value={config.title} onChange={e => setField('title', e.target.value)} placeholder="输入试卷标题" />
        </Form.Item>
        <Form.Item label="试卷说明">
          <TextArea value={config.description} onChange={e => setField('description', e.target.value)} rows={3} />
        </Form.Item>
        <div className="grid grid-cols-2 gap-4">
          <Form.Item label="考试时长（分钟）">
            <Input
              type="number"
              min={1}
              value={config.duration}
              onChange={e => setField('duration', parseInt(e.target.value) || 1)}
            />
          </Form.Item>
          <Form.Item label="总分值">
            <Input
              type="number"
              min={1}
              value={config.totalScore}
              onChange={e => setField('totalScore', parseInt(e.target.value) || 1)}
            />
          </Form.Item>
          <Form.Item label="题目总数" className="col-span-2">
            <Input
              type="number"
              min={1}
              value={config.totalQuestions}
              onChange={e => {
                const next = parseInt(e.target.value)
                setField('totalQuestions', Number.isNaN(next) ? 1 : Math.max(1, next))
              }}
              placeholder="请输入题目总数"
            />
          </Form.Item>
        </div>
        <Form.Item label="整体难度">
          <Select
            value={config.difficulty}
            onChange={v => setField('difficulty', v)}
            options={[
              { label: '简单', value: 'easy' },
              { label: '中等', value: 'medium' },
              { label: '困难', value: 'hard' },
              { label: '混合难度', value: 'mixed' },
            ]}
          />
        </Form.Item>
      </Form>
    </Card>
  )
}
