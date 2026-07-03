import React from 'react'
import { Select, Space, Tag } from 'antd'
import { translate } from '@/shared/utils/i18n'

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
      placeholder={translate('questions.tags_ph')}
    />
  )
}
