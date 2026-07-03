import React from 'react'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { Checkbox, Radio } from 'antd'
import type { FormListFieldData, FormListOperation } from 'antd/es/form'
import { Button, Form } from '@/shared/components/ui'
import { translate } from '@/shared/utils/i18n'

/** 题目类型（这里只区分选择题两类） */
export type ChoiceMode = 'single' | 'multiple'

export default function OptionsEditor({ mode, name = 'options' }: { mode: ChoiceMode; name?: string }) {
  const isMultiple = mode === 'multiple'

  return (
    <Form.List
      name={name}
      rules={[
        {
          validator: async (_: unknown, v: unknown) => {
            const arr = Array.isArray(v) ? v.filter((x: any) => (x?.content ?? '').trim()) : []
            if (arr.length < 2) return Promise.reject(translate('visible.63f6a19ddf'))
          },
        },
      ]}
    >
      {(fields: FormListFieldData[], { add, remove }: FormListOperation) => (
        <>
          {fields.map((field, idx) => (
            <div key={field.key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
              {isMultiple ? (
                <Form.Item name={[field.name, 'is_correct']} valuePropName="checked" style={{ marginBottom: 0 }}>
                  <Checkbox />
                </Form.Item>
              ) : (
                <Form.Item style={{ marginBottom: 0 }}>
                  <Form.Item noStyle shouldUpdate>
                    {({ getFieldValue, setFieldsValue }) => {
                      const list = getFieldValue(name) || []
                      const checked = !!list?.[idx]?.is_correct
                      return (
                        <Radio
                          checked={checked}
                          onChange={() => {
                            const next = (list || []).map((o: any, i: number) => ({ ...o, is_correct: i === idx }))
                            setFieldsValue({ [name]: next })
                          }}
                        />
                      )
                    }}
                  </Form.Item>
                </Form.Item>
              )}

              <Form.Item
                name={[field.name, 'content']}
                rules={[{ required: true, message: translate('auto.7100773463') }]}
                style={{ flex: 1, marginBottom: 0 }}
              >
                <Form.Input
                  placeholder={`选项 ${String.fromCharCode(65 + idx)} 内容`}
                  prefix={`${String.fromCharCode(65 + idx)}.`}
                />
              </Form.Item>

              <Button
                aria-label={translate('auto.cedaea7425')}
                icon={<DeleteOutlined />}
                danger
                onClick={() => remove(field.name)}
                disabled={fields.length <= 2}
              />
            </div>
          ))}

          <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ content: '', is_correct: false })} block>
            {translate('questions.add_option')}</Button>
        </>
      )}
    </Form.List>
  )
}
