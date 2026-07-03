import { Button, Form, Input, Select } from 'antd'
import { translate } from '@/shared/utils/i18n'

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
      <Form.Item label={translate('papers.title_ph')} required>
        <Input value={title} onChange={e => onChange({ title: e.target.value })} placeholder={translate('auto.cd273f855c')} />
      </Form.Item>

      <Form.Item label={translate('auto.8f2a2b8c8d')}>
        <TextArea
          value={description}
          onChange={e => onChange({ description: e.target.value })}
          rows={4}
          placeholder={translate('auto.13b97574b2')}
        />
      </Form.Item>

      <Form.Item label={translate('auto.12511b57ac')} required>
        <Input
          type="number"
          min={1}
          value={duration}
          onChange={e => onChange({ duration: Math.max(1, Number(e.target.value) || 1) })}
        />
      </Form.Item>

      <Form.Item label={translate('auto.ee33d84f8a')} required>
        <Select
          value={difficulty}
          onChange={v => onChange({ difficulty: v })}
          options={[
            { label: translate('questions.easy'), value: 'easy' },
            { label: translate('questions.medium'), value: 'medium' },
            { label: translate('questions.hard'), value: 'hard' },
          ]}
        />
      </Form.Item>

      <div style={{ paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{translate('auto.625c240809')}</span>
          <b>{selectedCount}</b>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <span>{translate('papers.col_total_score')}</span>
          <b>{totalScore} {translate('papers.addon_score')}</b>
        </div>
      </div>

      <Button type="primary" htmlType="submit" block style={{ marginTop: 24 }} loading={submitting}>
        {translate('papers.create_paper')}</Button>
    </Form>
  )
}
