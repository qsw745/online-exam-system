// features/questions/practice/components/PracticeFooter.tsx
import { Button, Space } from 'antd'
import { BookOpen, ChevronRight, CheckCircle } from 'lucide-react'
import React from 'react'
import { translate } from '@/shared/utils/i18n'

export function PracticeFooter({
  mode,
  canSubmit,
  answered,
  onSubmit,
  onRetry,
  onNext,
  isLast,
}: {
  mode: 'single' | 'continuous'
  canSubmit: boolean
  answered: boolean
  onSubmit: () => void
  onRetry: () => void
  onNext: () => void
  isLast: boolean
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      {!answered ? (
        <Button type="primary" size="large" icon={<CheckCircle size={16} />} onClick={onSubmit} disabled={!canSubmit}>
          {translate('exam.submit')}</Button>
      ) : (
        <Space>
          <Button icon={<BookOpen size={16} />} onClick={onRetry}>
            {translate('auto.a5e6460134')}</Button>
          {mode === 'continuous' && (
            <Button type="primary" size="large" onClick={onNext} disabled={isLast}>
              {isLast ? translate('visible.90d19c03bf') : translate('exam.next')} {!isLast && <ChevronRight size={16} />}
            </Button>
          )}
        </Space>
      )}
    </div>
  )
}
