import * as React from "react"
import { Switch as AntSwitch } from "antd"
import { cn } from "../../lib/utils"

export interface SwitchProps extends React.ComponentProps<typeof AntSwitch> {}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, ...props }, ref) => {
    return (
      <AntSwitch
        className={cn(
          "rounded-full",
          className
        )}
        ref={ref as any}
        {...props}
      />
    )
  }
)

Switch.displayName = "Switch"

export { Switch }