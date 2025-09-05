// features/admin-settings/components/SectionCard.tsx
import { Card } from 'antd'
import React from 'react'

export const SectionCard: React.FC<React.PropsWithChildren<{ title: string; loading?: boolean }>> = ({
  title,
  loading,
  children,
}) => (
  <Card title={title} loading={loading}>
    {children}
  </Card>
)
