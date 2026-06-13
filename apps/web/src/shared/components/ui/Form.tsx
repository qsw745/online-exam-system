import React from 'react'
import { Form as AntForm, FormProps as AntFormProps, FormItemProps, Input, Select, Radio, Divider } from 'antd'

/**
 * 放宽 children 类型到 antd 的定义（RenderProps | ReactNode）；
 * 并在传给 <AntForm> 时做一次安全断言，避免 TS 对 children 的窄化报错。
 */
export type FormProps = Omit<AntFormProps, 'children'> & {
  /** 统一竖向布局开关（默认竖向）；若要自定义，可传 layout 覆盖 */
  vertical?: boolean
  /** 兼容 antd 的 RenderProps */
  children?: AntFormProps['children']
}

type FormComponent = ((props: FormProps) => React.ReactElement) & {
  Item: typeof AntForm.Item
  useForm: typeof AntForm.useForm
  useWatch: typeof AntForm.useWatch
  List: typeof AntForm.List
  Input: typeof Input
  Select: typeof Select
  Radio: typeof Radio
  Divider: typeof Divider
}

const InternalForm = ({ vertical = true, layout, ...props }: FormProps) => {
  const finalLayout = vertical ? 'vertical' : layout
  // 关键：把 props 断言为 any，避免 TS 将 children 错误收窄为 ReactNode
  return <AntForm {...(props as any)} layout={finalLayout} />
}

const Form = InternalForm as unknown as FormComponent

Form.Item = AntForm.Item
Form.useForm = AntForm.useForm
Form.useWatch = AntForm.useWatch
Form.List = AntForm.List

// 常用输入控件透出，便于统一从 ui/Form 引用
Form.Input = Input
Form.Select = Select
Form.Radio = Radio
Form.Divider = Divider

export type { FormItemProps }
export default Form
