// features/questions/practice/components/OptionsList.tsx
import { Card, Checkbox, Radio, Space, Typography } from 'antd'
import React from 'react'
const { Text } = Typography

export function OptionsList({
  multiple,
  options,
  selected,
  correctIndices,
  answered,
  onChange,
}: {
  multiple: boolean
  options: Array<{ content: string }>
  selected: number[]
  correctIndices: number[]
  answered: boolean
  onChange: (idx: number) => void
}) {
  const Comp: any = multiple ? Checkbox : Radio
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      {options.map((opt, idx) => {
        const isSelected = selected.includes(idx)
        const isCorrect = correctIndices.includes(idx)
        const showCorrect = answered && isCorrect
        const showWrong = answered && isSelected && !isCorrect
        return (
          <Card
            key={idx}
            size="small"
            onClick={() => !answered && onChange(idx)}
            style={{
              cursor: answered ? 'default' : 'pointer',
              backgroundColor: showCorrect ? '#f6ffed' : showWrong ? '#fff2f0' : isSelected ? '#f0f5ff' : '#fafafa',
              borderColor: showCorrect ? '#b7eb8f' : showWrong ? '#ffccc7' : isSelected ? '#91caff' : '#d9d9d9',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Comp checked={isSelected} disabled={answered} style={{ marginRight: 12 }} />
              <Text>{opt.content}</Text>
            </div>
          </Card>
        )
      })}
    </Space>
  )
}
