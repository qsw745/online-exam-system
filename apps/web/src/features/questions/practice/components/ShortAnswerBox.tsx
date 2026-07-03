// features/questions/practice/components/ShortAnswerBox.tsx
import { Input } from 'antd'
import React from 'react'
import { translate } from '@/shared/utils/i18n'
const { TextArea } = Input
export function ShortAnswerBox({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  disabled: boolean
}) {
  return (
    <TextArea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={6}
      placeholder={translate('auto.977e722666')}
      disabled={disabled}
    />
  )
}
