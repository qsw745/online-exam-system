import { describe, expect, it } from 'vitest'

import { getTaskPracticePath } from './TaskDetailPage'

describe('TaskDetailPage 路由', () => {
  it('练习任务编号不会被当作题目编号', () => {
    expect(getTaskPracticePath('42')).toBe('/learning/practice?taskId=42')
  })
})
