// components/PaginationBar.tsx
import { Card, Pagination } from 'antd'
import React from 'react'
import { createPaginationConfig } from '@/shared/constants/pagination'

export function PaginationBar({
  current,
  total,
  pageSize,
  onChange,
  onSizeChange,
}: {
  current: number
  total: number
  pageSize: number
  onChange: (p: number) => void
  onSizeChange: (c: number, size: number) => void
}) {
  return (
    <Card>
      <Pagination
        current={current}
        total={total}
        pageSize={pageSize}
        onChange={onChange}
        onShowSizeChange={onSizeChange}
        {...createPaginationConfig({ pageSizeOptions: ['10', '15', '20', '30', '40', '50'] })}
      />
    </Card>
  )
}
