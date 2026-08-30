import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import StudentLearningHubPage from './StudentLearningHubPage'

describe('StudentLearningHubPage', () => {
  it.each([
    ['题目练习', '/learning/practice'],
    ['错题本', '/learning/wrong-questions'],
    ['我的收藏', '/learning/favorites'],
    ['学习进度', '/learning/progress'],
  ])('提供“%s”入口', (name, href) => {
    render(
      <MemoryRouter>
        <StudentLearningHubPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name })).toHaveAttribute('href', href)
  })
})
