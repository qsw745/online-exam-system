// features/questions/components/KnowledgePointsField.tsx
import { Button, Input, Space, Tag } from 'antd'
import React, { useState } from 'react'
export default function KnowledgePointsField({
  points,
  onChange,
  disabled,
}: {
  points: string[]
  onChange: (v: string[]) => void
  disabled?: boolean
}) {
  const [kw, setKw] = useState('')
  const add = () => {
    const v = kw.trim()
    if (!v || points.includes(v)) return
    onChange([...points, v])
    setKw('')
  }
  return (
    <>
      <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
        <Input
          value={kw}
          onChange={e => setKw(e.target.value)}
          onPressEnter={e => (e.preventDefault(), add())}
          placeholder="输入知识点"
          disabled={disabled}
        />
        <Button type="primary" onClick={add} disabled={disabled}>
          添加
        </Button>
      </Space.Compact>
      <Space wrap>
        {points.map((p, i) => (
          <Tag key={i} color="blue" closable={!disabled} onClose={() => onChange(points.filter((_, idx) => idx !== i))}>
            {p}
          </Tag>
        ))}
      </Space>
    </>
  )
}

// features/questions/components/TagsField.tsx
import { Select, Space, Tag } from 'antd'
export default function TagsField({
  value,
  all,
  onChange,
  readonly,
}: {
  value: string[]
  all: string[]
  onChange: (v: string[]) => void
  readonly?: boolean
}) {
  return readonly ? (
    value?.length ? (
      <Space wrap>
        {value.map((t, i) => (
          <Tag key={i} color="geekblue">
            {t}
          </Tag>
        ))}
      </Space>
    ) : (
      <span style={{ color: '#999' }}>-</span>
    )
  ) : (
    <Select
      mode="tags"
      value={value}
      onChange={v => onChange(v as string[])}
      options={all.map(t => ({ label: t, value: t }))}
      placeholder="选择或输入标签后回车"
    />
  )
}
