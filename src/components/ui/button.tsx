import * as React from "react"
import { Button as AntButton } from "antd"
import { cn } from "../../lib/utils"

export interface ButtonProps extends React.ComponentProps<typeof AntButton> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

const variantClassMap = {
  default: "bg-blue-600 text-white hover:bg-blue-700",
  destructive: "bg-red-600 text-white hover:bg-red-700",
  outline: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
  secondary: "bg-gray-100 text-gray-800 hover:bg-gray-200",
  ghost: "text-gray-700 hover:bg-gray-100",
  link: "text-blue-600 hover:underline",
}

const sizeClassMap = {
  default: "",
  sm: "text-xs py-1 px-2",
  lg: "text-base py-3 px-6",
  icon: "!w-9 !h-9 !p-2",
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", children, ...props }, ref) => {
    // 映射variant到Ant Design的type
    const getType = () => {
      switch (variant) {
        case "default":
          return "primary"
        case "destructive":
          return "primary" // danger属性会设置为true
        case "outline":
          return "default"
        case "secondary":
          return "default"
        case "ghost":
          return "text"
        case "link":
          return "link"
        default:
          return "primary"
      }
    }

    // 映射size到Ant Design的size
    const getSize = () => {
      switch (size) {
        case "sm":
          return "small"
        case "lg":
          return "large"
        default:
          return "middle"
      }
    }

    // 设置danger属性
    const getDanger = () => variant === "destructive"

    return (
      <AntButton
        className={cn(
          variantClassMap[variant],
          sizeClassMap[size],
          className
        )}
        type={getType()}
        size={getSize()}
        danger={getDanger()}
        ref={ref as any}
        {...props}
      >
        {children}
      </AntButton>
    )
  }
)

Button.displayName = "Button"

export { Button }