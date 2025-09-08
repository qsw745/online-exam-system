import React from 'react'
import { Card, Spin } from 'antd'

export interface SectionCardProps {
  title?: React.ReactNode
  extra?: React.ReactNode
  children?: React.ReactNode
  style?: React.CSSProperties
  loading?: boolean // ✅ 支持 loading
}

const SectionCard: React.FC<SectionCardProps> = ({ title, extra, style, loading, children }) => {
  return (
    <Card title={title} extra={extra} style={style}>
      <Spin spinning={!!loading}>
        <div>{children}</div>
      </Spin>
    </Card>
  )
}

export default SectionCard
export type { SectionCardProps as defaultSectionCardProps }
