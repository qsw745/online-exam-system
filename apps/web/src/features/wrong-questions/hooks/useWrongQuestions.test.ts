import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useWrongQuestions } from './useWrongQuestions'
const mocks = vi.hoisted(() => ({ api: { getWrongQuestions: vi.fn(), getPracticeStats: vi.fn(), markAsMastered: vi.fn(), removeFromWrongQuestions: vi.fn() }, message: { error: vi.fn(), success: vi.fn() } }))
vi.mock('antd', () => ({ App: { useApp: () => ({ message: mocks.message }) } }))
vi.mock('@/shared/api/http', () => ({ wrongQuestions: mocks.api, isSuccess: (r: { success: boolean }) => r.success }))
const row = { id: 99, question_id: 1, content: '错题一', is_mastered: '0' }
const response = (items: unknown[], total = items.length) => ({ success: true, data: { wrongQuestions: items, total } })

describe('错题操作边界', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.api.getPracticeStats.mockResolvedValue({ success: true, data: { wrongQuestions: 1, masteredQuestions: 0 } })
    mocks.api.getWrongQuestions.mockResolvedValue(response([row]))
  })
  it('失败显示错误，刷新失败不提示成功', async () => {
    mocks.api.getWrongQuestions.mockResolvedValue({ success: false, error: '网络错误' })
    const { result } = renderHook(() => useWrongQuestions())
    await waitFor(() => expect(result.current.error).toBe('网络错误'))
    await act(async () => { await result.current.refresh() })
    expect(mocks.message.success).not.toHaveBeenCalled()
  })
  it('字符串 0 不会显示为已掌握，写入失败保留错题', async () => {
    mocks.api.removeFromWrongQuestions.mockResolvedValue({ success: false, error: '删除失败' })
    const { result } = renderHook(() => useWrongQuestions())
    await waitFor(() => expect(result.current.list).toHaveLength(1))
    expect(result.current.list[0].is_mastered).toBe(false)
    await act(async () => { await result.current.remove(1) })
    expect(result.current.list).toHaveLength(1)
    expect(mocks.api.removeFromWrongQuestions).toHaveBeenCalledTimes(1)
    expect(mocks.message.error).toHaveBeenCalledWith('删除失败')
  })
  it('快速切换筛选，旧请求不覆盖新列表', async () => {
    let resolve!: (value: unknown) => void
    mocks.api.getWrongQuestions.mockReturnValueOnce(new Promise(r => { resolve = r })).mockResolvedValueOnce(response([{ ...row, question_id: 2, is_mastered: true }]))
    const { result } = renderHook(() => useWrongQuestions())
    act(() => result.current.setFilter('mastered'))
    await waitFor(() => expect(result.current.list[0]?.question_id).toBe(2))
    await act(async () => resolve(response([row])))
    expect(result.current.list[0].question_id).toBe(2)
  })
  it('退出后完成的删除不刷新列表或显示过期提示', async () => {
    let resolve!: (value: unknown) => void
    mocks.api.removeFromWrongQuestions.mockReturnValue(new Promise(r => { resolve = r }))
    const { result, unmount } = renderHook(() => useWrongQuestions())
    await waitFor(() => expect(result.current.list).toHaveLength(1))
    act(() => { void result.current.remove(1) })
    const reads = mocks.api.getWrongQuestions.mock.calls.length
    unmount()
    await act(async () => resolve({ success: true, data: null }))
    expect(mocks.api.getWrongQuestions).toHaveBeenCalledTimes(reads)
    expect(mocks.message.success).not.toHaveBeenCalled()
  })
  it('删除最后一页的唯一错题后回到有效页，连续点击只发一次', async () => {
    mocks.api.getWrongQuestions.mockResolvedValue(response([row], 11))
    let resolve!: (value: unknown) => void
    mocks.api.removeFromWrongQuestions.mockReturnValue(new Promise(r => { resolve = r }))
    const { result } = renderHook(() => useWrongQuestions())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.onPageChange(2) })
    act(() => { void result.current.remove(1); void result.current.remove(1) })
    expect(mocks.api.removeFromWrongQuestions).toHaveBeenCalledTimes(1)
    mocks.api.getWrongQuestions.mockResolvedValue(response([], 10))
    await act(async () => resolve({ success: true, data: null }))
    await waitFor(() => expect(result.current.page).toBe(1))
    expect(result.current.total).toBe(10)
  })
})
