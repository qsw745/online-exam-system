import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useLearningProgress } from './useLearningProgress'
const mocks = vi.hoisted(() => ({ getStats: vi.fn(), getRecords: vi.fn(), getSubjects: vi.fn() }))
vi.mock('@/shared/api/endpoints/learningProgress', () => ({ learningProgressApi: mocks }))
beforeEach(() => {
  vi.resetAllMocks()
  mocks.getSubjects.mockResolvedValue([{ id: '7', name: '数学' }])
  mocks.getStats.mockResolvedValue({ questions_practiced: 20 })
  mocks.getRecords.mockResolvedValue([{ id: 1, subject: '7' }])
})
describe('学习进度筛选状态', () => {
  it('失败显示错误并可重试，不呈现零统计', async () => {
    mocks.getStats.mockRejectedValueOnce(new Error('统计读取失败'))
    const { result } = renderHook(() => useLearningProgress())
    await waitFor(() => expect(result.current.error).toBe('统计读取失败'))
    expect(result.current.stats).toBeNull()
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.stats?.questions_practiced).toBe(20))
    expect(result.current.records[0].subject).toBe('数学')
  })
  it('快速切换筛选时，旧统计和旧记录均不能覆盖新结果', async () => {
    let stats!: (value: unknown) => void
    let records!: (value: unknown) => void
    mocks.getStats.mockReturnValueOnce(new Promise(r => { stats = r }))
    mocks.getRecords.mockReturnValueOnce(new Promise(r => { records = r }))
    const { result } = renderHook(() => useLearningProgress())
    act(() => result.current.setSubject('7'))
    await waitFor(() => expect(result.current.stats?.questions_practiced).toBe(20))
    await act(async () => { stats({ questions_practiced: 99 }); records([{ id: 9, subject: '旧科目' }]) })
    expect(result.current.stats?.questions_practiced).toBe(20)
    expect(result.current.records[0].subject).toBe('数学')
  })
})
