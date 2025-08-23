import * as React from "react"
import { Input as AntInput } from "antd"
import { cn } from "../../lib/utils"

export interface InputProps extends React.ComponentProps<typeof AntInput> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <AntInput
        className={cn(
          "rounded-md",
          className
        )}
        ref={ref as any}
        {...props}
      />
    )
  }
)

Input.displayName = "Input"

export { Input }