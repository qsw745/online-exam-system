// features/questions/components/TrueFalseEditor.tsx
import { Radio } from 'antd'
export const TrueFalseEditor = ({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) => (
  <Radio.Group value={value} onChange={e => onChange(e.target.value)} disabled={disabled}>
    <Radio value="true">正确</Radio>
    <Radio value="false">错误</Radio>
  </Radio.Group>
)

// features/questions/components/ShortAnswerEditor.tsx
import { Input } from 'antd'
const { TextArea } = Input
export const ShortAnswerEditor = ({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) => (
  <TextArea
    rows={4}
    value={value}
    onChange={e => onChange(e.target.value)}
    disabled={disabled}
    placeholder="输入参考答案"
  />
)
