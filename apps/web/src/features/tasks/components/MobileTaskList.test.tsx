import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Task } from '../hooks/useTasksQuery'
import MobileTaskList from './MobileTaskList'

const task: Task = {
  id: 'task-21',
  title: '安全培训考试',
  description: '完成年度安全知识测评',
  type: 'exam',
  status: 'published',
  start_time: null,
  end_time: null,
  exam_id: 21,
}

describe('MobileTaskList', () => {
  it('使用真实任务卡并转发开始操作', async () => {
    const onStart = vi.fn()
    const user = userEvent.setup()
    render(<MobileTaskList tasks={[task]} loading={false} onStart={onStart} />)
    expect(screen.getByText('安全培训考试')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '开始考试' }))
    expect(onStart).toHaveBeenCalledWith(task)
  })

  it('空列表显示明确提示', () => {
    render(<MobileTaskList tasks={[]} loading={false} onStart={vi.fn()} />)
    expect(screen.getByText('当前没有符合条件的任务')).toBeInTheDocument()
  })
})
