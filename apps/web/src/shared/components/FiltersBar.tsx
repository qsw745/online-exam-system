import React, { ReactNode, useEffect, useMemo, useState } from 'react'
import { Button, Form, Input, Space, Tooltip } from 'antd'
import { ReloadOutlined, SearchOutlined, InfoCircleOutlined } from '@ant-design/icons'
import type { FormInstance, FormProps } from 'antd'
import { useDebounce } from '@shared/hooks'

export interface FiltersBarProps<FieldType extends object = any> {
  /** 组合式：可直接写 Form.Item 作为 children */
  children?: ReactNode
  /** 右侧动作（导出、新建等） */
  actions?: ReactNode
  /** 提交回调（点击搜索/回车/自动触发） */
  onSubmit?: (values: FieldType) => void
  /** 值变化（即时） */
  onValuesChange?: FormProps<FieldType>['onValuesChange']
  /** 初始值 */
  initialValues?: Partial<FieldType>
  /** 是否展示“重置”按钮，默认 true */
  showReset?: boolean
  /** 是否在值变化后自动触发提交（结合 debounce 使用） */
  autoSubmit?: boolean
  /** 自动触发的防抖时间（ms），默认 400ms */
  debounceMs?: number
  /** 表单布局，默认 inline */
  layout?: FormProps<FieldType>['layout']
  /** 占位/提示信息 */
  hint?: ReactNode
  /** 外部传入 form（可选） */
  form?: FormInstance<FieldType>
}

function FiltersBar<FieldType extends object = any>({
  children,
  actions,
  onSubmit,
  onValuesChange,
  initialValues,
  showReset = true,
  autoSubmit = false,
  debounceMs = 400,
  layout = 'inline',
  hint,
  form: externalForm,
}: FiltersBarProps<FieldType>) {
  const [form] = Form.useForm<FieldType>()
  const formInst = externalForm ?? form
  const [inner, setInner] = useState<Partial<FieldType>>(initialValues ?? {})

  // 同步外部初始值
  useEffect(() => {
    if (initialValues) {
      formInst.setFieldsValue(initialValues as any)
      setInner(initialValues)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialValues)])

  const debounced = useDebounce(inner, debounceMs)

  useEffect(() => {
    if (autoSubmit && onSubmit) {
      onSubmit(debounced as FieldType)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  const handleFinish = (vals: FieldType) => {
    onSubmit?.(vals)
  }

  const handleReset = () => {
    formInst.resetFields()
    const vals = formInst.getFieldsValue()
    setInner(vals)
    onSubmit?.(vals)
  }

  const handleValuesChange: FormProps<FieldType>['onValuesChange'] = (changed, all) => {
    setInner(all)
    onValuesChange?.(changed, all)
  }

  const hintNode = useMemo(() => {
    if (!hint) return null
    return (
      <Tooltip title={hint}>
        <InfoCircleOutlined />
      </Tooltip>
    )
  }, [hint])

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
      <Form<FieldType>
        form={formInst}
        layout={layout}
        initialValues={initialValues}
        onValuesChange={handleValuesChange}
        onFinish={handleFinish}
        style={{ flex: 1, minWidth: 0 }}
      >
        <Space wrap align="center">
          {children}
          <Space.Compact>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
              搜索
            </Button>
            {showReset && <Button onClick={handleReset} icon={<ReloadOutlined />} />}
            {hintNode}
          </Space.Compact>
        </Space>
      </Form>

      {actions && (
        <Space wrap align="center" style={{ marginLeft: 12 }}>
          {actions}
        </Space>
      )}
    </div>
  )
}

/** 便捷：搜索框 */
export function FiltersSearchInput(props: { name?: string; placeholder?: string; allowClear?: boolean }) {
  return (
    <Form.Item name={props.name ?? 'q'} noStyle>
      <Input
        allowClear={props.allowClear ?? true}
        placeholder={props.placeholder ?? '输入关键词'}
        onPressEnter={e => {
          // Antd Form 在 Item + Input + submit 按回车会自动触发 onFinish，这里不用额外处理
        }}
      />
    </Form.Item>
  )
}

FiltersBar.SearchInput = FiltersSearchInput

export default FiltersBar as typeof FiltersBar & { SearchInput: typeof FiltersSearchInput }
