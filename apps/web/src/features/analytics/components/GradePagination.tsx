// apps/web/src/features/analytics/components/GradePagination.tsx
import React from 'react'
import { Flex, Typography } from 'antd'
import GlobalPagination from '@/shared/components/GlobalPagination'
import { translate } from '@/shared/utils/i18n'

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
        {translate('auto.78715e49e9')}{start} - {end} {translate('auto.a0ba8f7a92')}{totalResults} {translate('auto.69d28aa1b0')}</Text>
      <GlobalPagination
        current={page}
        pageSize={pageSize}
        total={totalResults}
        onChange={(p: number) => onChange(p)}
        showSizeChanger={false}
      />
    </Flex>
  )
}
