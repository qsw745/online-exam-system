import React from 'react'
import { Card } from 'antd'

export const SettingSection: React.FC<{
  title: React.ReactNode
  children?: React.ReactNode
}> = ({ title, children }) => {
  return (
    <Card title={title} size="small" style={{ width: '100%' }}>
      {children}
    </Card>
  )
}
