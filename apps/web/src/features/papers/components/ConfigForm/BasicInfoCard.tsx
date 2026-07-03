// features/smart-paper/components/ConfigForm/BasicInfoCard.tsx
import { Card, Form, Input, Select } from 'antd'
import type { SmartPaperConfig } from '../../../../shared/api/endpoints/smartPaper'
import { translate } from '@/shared/utils/i18n'
const { TextArea } = Input

export default function BasicInfoCard({
  config,
  setField,
}: {
  config: SmartPaperConfig
  setField: <K extends keyof SmartPaperConfig>(k: K, v: SmartPaperConfig[K]) => void
}) {
  return (
    <Card title={translate('auto.b122f813d5')} className="mb-6">
      <Form layout="vertical">
        <Form.Item label={translate('papers.title_ph')} required>
          <Input value={config.title} onChange={e => setField('title', e.target.value)} placeholder={translate('auto.cd273f855c')} />
        </Form.Item>
        <Form.Item label={translate('auto.8f2a2b8c8d')}>
          <TextArea value={config.description} onChange={e => setField('description', e.target.value)} rows={3} />
        </Form.Item>
        <div className="grid grid-cols-2 gap-4">
          <Form.Item label={translate('auto.12511b57ac')}>
            <Input
              type="number"
              min={1}
              value={config.duration}
              onChange={e => setField('duration', parseInt(e.target.value) || 1)}
            />
          </Form.Item>
          <Form.Item label={translate('auto.30667c2c03')}>
            <Input
              type="number"
              min={1}
              value={config.totalScore}
              onChange={e => setField('totalScore', parseInt(e.target.value) || 1)}
            />
          </Form.Item>
          <Form.Item label={translate('auto.b824183d87')} className="col-span-2">
            <Input
              type="number"
              min={1}
              value={config.totalQuestions}
              onChange={e => {
                const next = parseInt(e.target.value)
                setField('totalQuestions', Number.isNaN(next) ? 1 : Math.max(1, next))
              }}
              placeholder={translate('auto.d67daf2ae4')}
            />
          </Form.Item>
        </div>
        <Form.Item label={translate('auto.64b74cf211')}>
          <Select
            value={config.difficulty}
            onChange={v => setField('difficulty', v)}
            options={[
              { label: translate('questions.easy'), value: 'easy' },
              { label: translate('questions.medium'), value: 'medium' },
              { label: translate('questions.hard'), value: 'hard' },
              { label: translate('auto.7fdd6fd305'), value: 'mixed' },
            ]}
          />
        </Form.Item>
      </Form>
    </Card>
  )
}
