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

  it('已完成任务转发查看成绩，并提供详情操作', async () => {
    const completed = { ...task, my_result_status: 'graded', my_result_id: 7, end_time: '2020-01-01' }
    const onStart = vi.fn()
    const onView = vi.fn()
    const user = userEvent.setup()
    render(<MobileTaskList tasks={[completed]} onStart={onStart} onView={onView} />)
    expect(screen.queryByRole('button', { name: '开始考试' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '查看成绩' }))
    expect(onStart).toHaveBeenCalledWith(completed)
    await user.click(screen.getByRole('button', { name: '查看详情' }))
    expect(onView).toHaveBeenCalledWith(completed)
  })
})
