import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import BrandMark from './BrandMark'

describe('BrandMark', () => {
  it('完整模式显示品牌、副标题和可访问图标', () => {
    render(<BrandMark />)
    expect(screen.getByRole('img', { name: '问衡' })).toBeInTheDocument()
    expect(screen.getByText('问衡')).toBeInTheDocument()
    expect(screen.getByText('AI 智能测评与学习平台')).toBeInTheDocument()
  })

  it('紧凑模式隐藏副标题但保留品牌名', () => {
    render(<BrandMark compact />)
    expect(screen.getByText('问衡')).toBeInTheDocument()
    expect(screen.queryByText('AI 智能测评与学习平台')).not.toBeInTheDocument()
  })
})
