import { beforeEach, describe, expect, it, vi } from 'vitest'
import dayjs from 'dayjs'
import { learningProgressApi } from './learningProgress'
const mocks = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('../core/httpClient', () => ({ api: mocks }))
beforeEach(() => vi.resetAllMocks())
describe('学习进度接口契约', () => {
  it('解析服务端 totalStats，并发送与记录一致的日期及科目 ID', async () => {
    mocks.get.mockResolvedValue({ success: true, data: { totalStats: { total_study_time: '90', total_questions: '20', correct_answers: '15', study_days: 3, subjects_studied: 2 } } })
    expect(await learningProgressApi.getStats({ start: dayjs('2026-09-01'), end: dayjs('2026-09-05'), subject: '7' })).toEqual({
      total_study_time: 90, questions_practiced: 20, correct_answers: 15, correct_rate: 75, study_days: 3, subjects_studied: 2,
    })
    expect(mocks.get).toHaveBeenCalledWith('/learning-progress/stats', { params: { period: 'all', start_date: '2026-09-01', end_date: '2026-09-05', subjectId: '7' } })
  })
  it('科目对象转换为选择项，记录数字 ID 不直接作为 React 对象渲染', async () => {
    mocks.get.mockResolvedValueOnce({ success: true, data: [{ id: 7, name: '数学' }] })
    expect(await learningProgressApi.getSubjects()).toEqual([{ id: '7', name: '数学' }])
    mocks.get.mockResolvedValueOnce({ success: true, data: [{ id: 1, subject: 7, questions_count: '4', correct_count: '3', study_time: '15' }] })
    expect((await learningProgressApi.getRecords({}))[0]).toMatchObject({ subject: '7', questions_count: 4, correct_count: 3, study_time: 15 })
  })
  it('失败不会伪装成零统计或空记录', async () => {
    mocks.get.mockResolvedValue({ success: false, error: '服务不可用' })
    await expect(learningProgressApi.getStats({})).rejects.toThrow('服务不可用')
    await expect(learningProgressApi.getRecords({})).rejects.toThrow('服务不可用')
    await expect(learningProgressApi.getSubjects()).rejects.toThrow('服务不可用')
  })
})
