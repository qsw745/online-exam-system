import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import BackgroundPrivacyCover from './BackgroundPrivacyCover'

describe('BackgroundPrivacyCover', () => {
  it('前台活动时不遮挡业务内容', () => {
    render(<BackgroundPrivacyCover lifecycle="active" />)

    expect(screen.queryByText('内容已保护')).not.toBeInTheDocument()
  })

  it.each(['inactive', 'background'] as const)('%s 时显示问衡隐私遮罩', (lifecycle) => {
    render(<BackgroundPrivacyCover lifecycle={lifecycle} />)

    expect(screen.getByText('问衡')).toBeInTheDocument()
    expect(screen.getByText('内容已保护')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })
})
