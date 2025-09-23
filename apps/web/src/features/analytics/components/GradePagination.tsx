// apps/web/src/features/analytics/components/GradePagination.tsx
import React from 'react'
import { Flex, Pagination, Typography } from 'antd'

type Props = {
  page: number
  pageSize: number
  totalPages: number
  totalResults: number
  onChange: (p: number) => void
}

const { Text } = Typography

export const GradePagination: React.FC<Props> = ({ page, pageSize, totalPages, totalResults, onChange }) => {
  if (totalPages <= 1) return null

  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalResults)

  return (
    <Flex align="center" justify="space-between" wrap="wrap" gap={12}>
      <Text type="secondary">
        显示第 {start} - {end} 条，共 {totalResults} 条记录
      </Text>
      <Pagination current={page} pageSize={pageSize} total={totalResults} showSizeChanger={false} onChange={onChange} />
    </Flex>
  )
}
