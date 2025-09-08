// features/questions/components/OptionsEditor.tsx
import { Button, Checkbox, Col, Input, Row, Space } from 'antd'
import { Plus, Trash2 } from 'lucide-react'
import type { OptionDTO } from '../../../shared/types/question'

export default function OptionsEditor({
  options,
  onChange,
  onAdd,
  onRemove,
  disabled,
}: {
  options: OptionDTO[]
  onChange: (index: number, patch: Partial<OptionDTO>) => void
  onAdd: () => void
  onRemove: (index: number) => void
  disabled?: boolean
}) {
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="dashed"
          size="small"
          onClick={onAdd}
          icon={<Plus style={{ width: 14, height: 14 }} />}
          disabled={disabled}
        >
          添加选项
        </Button>
      </div>
      {options.map((opt, i) => (
        <Row key={i} gutter={[8, 0]} align="middle">
          <Col flex="none">
            <Checkbox
              checked={!!opt.is_correct}
              onChange={e => onChange(i, { is_correct: e.target.checked })}
              disabled={disabled}
            />
          </Col>
          <Col flex="auto">
            <Input
              value={opt.content}
              onChange={e => onChange(i, { content: e.target.value })}
              placeholder={`选项 ${i + 1}`}
              disabled={disabled}
            />
          </Col>
          <Col flex="none">
            <Button
              type="text"
              danger
              size="small"
              icon={<Trash2 style={{ width: 16, height: 16 }} />}
              onClick={() => onRemove(i)}
              disabled={disabled}
            />
          </Col>
        </Row>
      ))}
    </Space>
  )
}
