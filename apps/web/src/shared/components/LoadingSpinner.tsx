import React from 'react'
import { Spin, Typography } from 'antd'

interface LoadingSpinnerProps {
  /** sm -> small, md -> default, lg -> large */
  size?: 'sm' | 'md' | 'lg'
  /** 不传则不显示文案，避免“加载中…”默认字样 */
  text?: React.ReactNode
  /** AntD v5 全屏遮罩 */
  fullscreen?: boolean
  /** 'parent' 在父容器居中，'page' 占满整页居中，false 不做居中 */
  center?: 'parent' | 'page' | false
  className?: string
  /** 当 center='parent' 时可自定义最小高度 */
  minHeight?: number | string
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  text,
  fullscreen = false,
  center = 'parent',
  className,
  minHeight,
}) => {
  const sizeMap = { sm: 'small', md: 'default', lg: 'large' } as const

  if (fullscreen) {
    return <Spin size={sizeMap[size]} tip={typeof text === 'string' ? text : undefined} fullscreen />
  }

  // 统一用内联样式居中，不依赖 Tailwind
  let computedMinHeight: string | number | undefined
  if (center === 'page') {
    computedMinHeight = '100vh'
  } else if (center === 'parent') {
    if (minHeight !== undefined) {
      computedMinHeight = typeof minHeight === 'number' ? `${minHeight}px` : minHeight
    } else {
      computedMinHeight = 240 // 默认给个视觉上“能居中”的高度
    }
  }

  const wrapStyle: React.CSSProperties = {
    display: center ? 'grid' : undefined,
    placeItems: center ? 'center' : undefined,
    minHeight: computedMinHeight,
  }

  return (
    <div className={className} style={wrapStyle}>
      <div style={{ display: 'grid', justifyItems: 'center', gap: 8 }}>
        <Spin size={sizeMap[size]} />
        {text ? <Typography.Text type="secondary">{text}</Typography.Text> : null}
      </div>
    </div>
  )
}

export default LoadingSpinner
