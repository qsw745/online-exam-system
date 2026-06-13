// features/questions/practice/components/ShortAnswerBox.tsx
import { Input } from 'antd'
import React from 'react'
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
      placeholder="请输入您的答案..."
      disabled={disabled}
    />
  )
}
