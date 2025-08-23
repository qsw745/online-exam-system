import * as React from "react"
import { Checkbox as AntCheckbox } from "antd"
import { cn } from "../../lib/utils"

export interface CheckboxProps extends React.ComponentProps<typeof AntCheckbox> {}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <AntCheckbox
        className={cn(
          "rounded-sm",
          className
        )}
        ref={ref as any}
        {...props}
      />
    )
  }
)

Checkbox.displayName = "Checkbox"

export { Checkbox }