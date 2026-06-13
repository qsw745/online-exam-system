// features/questions/practice/components/PracticeHeader.tsx
import { Button, Space, Tag } from 'antd'
import { ArrowLeft, ChevronLeft, ChevronRight, Eye, EyeOff, Heart, HeartOff, SkipForward } from 'lucide-react'
import React from 'react'

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
          返回题库
        </Button>
        {mode === 'continuous' && total > 0 && (
          <Tag color="blue">
            进度: {index + 1} / {total}
          </Tag>
        )}
      </Space>
      <Space>
        {mode === 'continuous' && (
          <>
            <Button icon={<ChevronLeft size={16} />} onClick={onPrev} disabled={!canPrev}>
              上一题
            </Button>
            <Button
              icon={<SkipForward size={16} />}
              onClick={onSkip}
              style={{ color: '#fa8c16', borderColor: '#fa8c16' }}
            >
              跳过
            </Button>
            <Button type="primary" onClick={onNext} disabled={!canNext}>
              下一题 <ChevronRight size={16} />
            </Button>
          </>
        )}
        <Button
          icon={favorited ? <Heart size={16} /> : <HeartOff size={16} />}
          onClick={onToggleFavorite}
          danger={favorited}
          type={favorited ? 'primary' : 'default'}
        >
          {favorited ? '已收藏' : '收藏'}
        </Button>
        <Button
          icon={showExplanation ? <EyeOff size={16} /> : <Eye size={16} />}
          onClick={onToggleExplanation}
          type="primary"
          ghost
        >
          {showExplanation ? '隐藏解析' : '查看解析'}
        </Button>
      </Space>
    </div>
  )
}
