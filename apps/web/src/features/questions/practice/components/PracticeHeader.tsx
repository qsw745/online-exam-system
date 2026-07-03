// features/questions/practice/components/PracticeHeader.tsx
import { Button, Space, Tag } from 'antd'
import { ArrowLeft, ChevronLeft, ChevronRight, Eye, EyeOff, Heart, HeartOff, SkipForward } from 'lucide-react'
import React from 'react'
import { translate } from '@/shared/utils/i18n'

export function PracticeHeader({
  onBack,
  mode,
  index,
  total,
  onPrev,
  onNext,
  onSkip,
  canPrev,
  canNext,
  favorited,
  onToggleFavorite,
  showExplanation,
  onToggleExplanation,
}: {
  onBack: () => void
  mode: 'single' | 'continuous'
  index: number
  total: number
  onPrev: () => void
  onNext: () => void
  onSkip: () => void
  canPrev: boolean
  canNext: boolean
  favorited: boolean
  onToggleFavorite: () => void
  showExplanation: boolean
  onToggleExplanation: () => void
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Space>
        <Button icon={<ArrowLeft size={16} />} onClick={onBack}>
          {translate('auto.a74132a45e')}</Button>
        {mode === 'continuous' && total > 0 && (
          <Tag color="blue">
            {translate('auto.8aa84f452a')}{index + 1} / {total}
          </Tag>
        )}
      </Space>
      <Space>
        {mode === 'continuous' && (
          <>
            <Button icon={<ChevronLeft size={16} />} onClick={onPrev} disabled={!canPrev}>
              {translate('exam.previous')}</Button>
            <Button
              icon={<SkipForward size={16} />}
              onClick={onSkip}
              style={{ color: '#fa8c16', borderColor: '#fa8c16' }}
            >
              {translate('auto.31a98593f1')}</Button>
            <Button type="primary" onClick={onNext} disabled={!canNext}>
              {translate('exam.next')}<ChevronRight size={16} />
            </Button>
          </>
        )}
        <Button
          icon={favorited ? <Heart size={16} /> : <HeartOff size={16} />}
          onClick={onToggleFavorite}
          danger={favorited}
          type={favorited ? 'primary' : 'default'}
        >
          {favorited ? translate('visible.2d2cdabf29') : translate('header.favorites')}
        </Button>
        <Button
          icon={showExplanation ? <EyeOff size={16} /> : <Eye size={16} />}
          onClick={onToggleExplanation}
          type="primary"
          ghost
        >
          {showExplanation ? translate('visible.fbdfb3c5b1') : translate('visible.716d473a0a')}
        </Button>
      </Space>
    </div>
  )
}
