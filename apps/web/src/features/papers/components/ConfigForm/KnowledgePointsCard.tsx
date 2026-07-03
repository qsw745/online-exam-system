// features/smart-paper/components/ConfigForm/KnowledgePointsCard.tsx
import { Card, Checkbox, Form } from 'antd'
import { translate } from '@/shared/utils/i18n'

export default function KnowledgePointsCard({
  value,
  options,
  onChange,
}: {
  value: string[]
  options: string[]
  onChange: (vals: string[]) => void
}) {
  return (
    <Card title={translate('auto.0324935683')} className="mb-6">
      <Form layout="vertical">
        <Form.Item label={translate('auto.7d8c568c06')}>
          <div className="max-h-40 overflow-y-auto">
            <Checkbox.Group value={value} onChange={v => onChange(v as string[])}>
              <div className="space-y-2">
                {options.map(p => (
                  <div key={p}>
                    <Checkbox value={p}>{p}</Checkbox>
                  </div>
                ))}
              </div>
            </Checkbox.Group>
          </div>
        </Form.Item>
      </Form>
    </Card>
  )
}
