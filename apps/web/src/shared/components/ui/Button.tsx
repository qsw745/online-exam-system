import React from 'react'
import { Button as AntButton, ButtonProps } from 'antd'

/** 避免与 antd v5 的 variant 冲突，改成 preset */
export interface BaseButtonProps extends Omit<ButtonProps, 'variant'> {
  preset?: 'primary' | 'default' | 'danger' | 'link'
}

const Button = (props: BaseButtonProps) => {
  const { preset = 'default', type, danger, ...rest } = props
  const finalType: ButtonProps['type'] =
    type ?? (preset === 'primary' ? 'primary' : preset === 'link' ? 'link' : undefined)
  const finalDanger = danger ?? preset === 'danger'
  return <AntButton type={finalType} danger={finalDanger} {...rest} />
}

export default Button
