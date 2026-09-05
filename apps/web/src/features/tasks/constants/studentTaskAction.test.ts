import { describe, expect, it } from 'vitest'
import { getStudentTaskAction } from './studentTaskAction'

const now = Date.parse('2026-09-05T08:00:00Z')
const task = { type: 'exam', status: 'published' }

describe('学生任务操作', () => {
  it.each(['completed', 'submitted', 'graded'])('已 %s 的任务即使过期仍可查看成绩', status => {
    expect(getStudentTaskAction({ ...task, my_result_status: status, my_result_id: 7, end_time: '2026-01-01' }, now))
      .toMatchObject({ label: '查看成绩', disabled: false, visibleStatus: 'completed' })
  })

  it('成绩尚未发布时不重新开考', () => {
    expect(getStudentTaskAction({ ...task, my_result_status: 'graded' }, now))
      .toMatchObject({ disabled: true, reason: '成绩暂未发布，请稍后查看' })
  })

  it('精确到截止时间时不能开始，开始时间相等时可以开始', () => {
    expect(getStudentTaskAction({ ...task, end_time: new Date(now).toISOString() }, now).disabled).toBe(true)
    expect(getStudentTaskAction({ ...task, start_time: new Date(now).toISOString() }, now).disabled).toBe(false)
  })

  it.each([
    { start_time: 'invalid' },
    { end_time: 'invalid' },
    { start_time: '2027-01-01' },
    { status: 'unpublished' },
  ])('异常时间或不可开始状态不给出开考入口：%o', patch => {
    expect(getStudentTaskAction({ ...task, ...patch }, now).disabled).toBe(true)
  })

  it('已开始的个人答卷显示继续考试，不要求列表附带考试 ID', () => {
    expect(getStudentTaskAction({ ...task, my_result_status: 'in_progress' }, now))
      .toMatchObject({ label: '继续考试', visibleStatus: 'in_progress', disabled: false })
  })
})
