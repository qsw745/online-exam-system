import { Form, Input, Select } from 'antd'
import { translate } from '@/shared/utils/i18n'
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
      <Form.Item label={translate('papers.title_ph')} required>
        <Input
          value={title}
          onChange={e => onChange({ title: e.target.value })}
          disabled={disabled}
          placeholder={translate('auto.cd273f855c')}
        />
      </Form.Item>

      <Form.Item label={translate('auto.8f2a2b8c8d')}>
        <TextArea
          value={description}
          onChange={e => onChange({ description: e.target.value })}
          disabled={disabled}
          rows={4}
          placeholder={translate('auto.13b97574b2')}
        />
      </Form.Item>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
        <Form.Item label={translate('auto.12511b57ac')}>
          <Input
            type="number"
            min={1}
            value={duration}
            onChange={e => onChange({ duration: Math.max(1, Number(e.target.value) || 1) })}
            disabled={disabled}
          />
        </Form.Item>
        <Form.Item label={translate('auto.30667c2c03')}>
          <Input
            type="number"
            min={1}
            value={totalScore}
            onChange={e => onChange({ totalScore: Math.max(1, Number(e.target.value) || 1) })}
            disabled={disabled}
          />
        </Form.Item>
        <Form.Item label={translate('auto.ee33d84f8a')}>
          <Select
            value={difficulty}
            onChange={v => onChange({ difficulty: v })}
            disabled={disabled}
            options={[
              { label: translate('questions.easy'), value: 'easy' },
              { label: translate('questions.medium'), value: 'medium' },
              { label: translate('questions.hard'), value: 'hard' },
            ]}
          />
        </Form.Item>
      </div>
    </div>
  )
}
