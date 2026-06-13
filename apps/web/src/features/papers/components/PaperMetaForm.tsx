import { Form, Input, Select } from 'antd'
const { TextArea } = Input

export default function PaperMetaForm({
  disabled,
  title,
  description,
  totalScore,
  duration,
  difficulty,
  onChange,
}: {
  disabled?: boolean
  title: string
  description: string
  totalScore: number
  duration: number
  difficulty: 'easy' | 'medium' | 'hard'
  onChange: (
    patch: Partial<{
      title: string
      description: string
      totalScore: number
      duration: number
      difficulty: 'easy' | 'medium' | 'hard'
    }>
  ) => void
}) {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Form.Item label="试卷标题" required>
        <Input
          value={title}
          onChange={e => onChange({ title: e.target.value })}
          disabled={disabled}
          placeholder="输入试卷标题"
        />
      </Form.Item>

      <Form.Item label="试卷说明">
        <TextArea
          value={description}
          onChange={e => onChange({ description: e.target.value })}
          disabled={disabled}
          rows={4}
          placeholder="输入试卷说明"
        />
      </Form.Item>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
        <Form.Item label="考试时长（分钟）">
          <Input
            type="number"
            min={1}
            value={duration}
            onChange={e => onChange({ duration: Math.max(1, Number(e.target.value) || 1) })}
            disabled={disabled}
          />
        </Form.Item>
        <Form.Item label="总分值">
          <Input
            type="number"
            min={1}
            value={totalScore}
            onChange={e => onChange({ totalScore: Math.max(1, Number(e.target.value) || 1) })}
            disabled={disabled}
          />
        </Form.Item>
        <Form.Item label="试卷难度">
          <Select
            value={difficulty}
            onChange={v => onChange({ difficulty: v })}
            disabled={disabled}
            options={[
              { label: '简单', value: 'easy' },
              { label: '中等', value: 'medium' },
              { label: '困难', value: 'hard' },
            ]}
          />
        </Form.Item>
      </div>
    </div>
  )
}
