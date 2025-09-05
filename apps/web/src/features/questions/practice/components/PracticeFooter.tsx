// features/questions/practice/components/PracticeFooter.tsx
import { Button, Space } from 'antd'
import { BookOpen, ChevronRight, CheckCircle } from 'lucide-react'
import React from 'react'

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
          提交答案
        </Button>
      ) : (
        <Space>
          <Button icon={<BookOpen size={16} />} onClick={onRetry}>
            重新练习
          </Button>
          {mode === 'continuous' && (
            <Button type="primary" size="large" onClick={onNext} disabled={isLast}>
              {isLast ? '已完成所有题目' : '下一题'} {!isLast && <ChevronRight size={16} />}
            </Button>
          )}
        </Space>
      )}
    </div>
  )
}
