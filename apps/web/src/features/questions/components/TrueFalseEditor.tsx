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
    <Radio value="true">{translate('questions.tf_true')}</Radio>
    <Radio value="false">{translate('questions.tf_false')}</Radio>
  </Radio.Group>
)

// features/questions/components/ShortAnswerEditor.tsx
import { Input } from 'antd'
import { translate } from '@/shared/utils/i18n'
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
    placeholder={translate('auto.7f89dc48c2')}
  />
)
