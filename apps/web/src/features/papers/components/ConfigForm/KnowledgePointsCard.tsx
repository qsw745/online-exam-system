// features/smart-paper/components/ConfigForm/KnowledgePointsCard.tsx
import { Card, Checkbox, Form } from 'antd'

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
    <Card title="知识点筛选" className="mb-6">
      <Form layout="vertical">
        <Form.Item label="选择要包含的知识点（可选）">
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
