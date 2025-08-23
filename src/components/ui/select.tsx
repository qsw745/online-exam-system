import * as React from "react"
import { Select as AntSelect } from "antd"
import { cn } from "../../lib/utils"

export interface SelectProps extends React.ComponentProps<typeof AntSelect> {
  options?: { label: string; value: string | number }[]
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options = [], children, ...props }, ref) => {
    return (
      <AntSelect
        className={cn("rounded-md", className)}
        options={options}
        ref={ref as any}
        {...props}
      >
        {children}
      </AntSelect>
    )
  }
)

Select.displayName = "Select"

// 为了保持与原有组件的兼容性，导出一些空组件
const SelectGroup = (props: any) => <>{props.children}</>
const SelectValue = (props: any) => <>{props.children}</>
const SelectTrigger = (props: any) => <>{props.children}</>
const SelectContent = (props: any) => <>{props.children}</>
const SelectLabel = (props: any) => <>{props.children}</>
const SelectItem = (props: any) => <>{props.children}</>
const SelectSeparator = (props: any) => <>{props.children}</>
const SelectScrollUpButton = (props: any) => <>{props.children}</>
const SelectScrollDownButton = (props: any) => <>{props.children}</>

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}