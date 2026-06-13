import { Button, Form, Input, Select } from 'antd'

const { TextArea } = Input

export default function PaperInfoForm({
  title,
  description,
  duration,
  difficulty,
  totalScore,
  selectedCount,
  submitting,
  onChange,
  onSubmit,
}: {
  title: string
  description: string
  duration: number
  difficulty: 'easy' | 'medium' | 'hard'
  totalScore: number
  selectedCount: number
  submitting: boolean
  onChange: (
    patch: Partial<{ title: string; description: string; duration: number; difficulty: 'easy' | 'medium' | 'hard' }>
  ) => void
  onSubmit: () => void
}) {
  return (
    <Form layout="vertical" onFinish={onSubmit}>
      <Form.Item label="试卷标题" required>
        <Input value={title} onChange={e => onChange({ title: e.target.value })} placeholder="输入试卷标题" />
      </Form.Item>

      <Form.Item label="试卷说明">
        <TextArea
          value={description}
          onChange={e => onChange({ description: e.target.value })}
          rows={4}
          placeholder="输入试卷说明"
        />
      </Form.Item>

      <Form.Item label="考试时长（分钟）" required>
        <Input
          type="number"
          min={1}
          value={duration}
          onChange={e => onChange({ duration: Math.max(1, Number(e.target.value) || 1) })}
        />
      </Form.Item>

      <Form.Item label="试卷难度" required>
        <Select
          value={difficulty}
          onChange={v => onChange({ difficulty: v })}
          options={[
            { label: '简单', value: 'easy' },
            { label: '中等', value: 'medium' },
            { label: '困难', value: 'hard' },
          ]}
        />
      </Form.Item>

      <div style={{ paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>已选题目数</span>
          <b>{selectedCount}</b>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <span>总分</span>
          <b>{totalScore} 分</b>
        </div>
      </div>

      <Button type="primary" htmlType="submit" block style={{ marginTop: 24 }} loading={submitting}>
        创建试卷
      </Button>
    </Form>
  )
}
