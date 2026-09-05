import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useResultDetail } from './useResultDetail'
const mocks = vi.hoisted(() => ({ getDetail: vi.fn() }))
vi.mock('@/shared/api/endpoints/results', () => ({ resultsApi: mocks }))

describe('成绩详情请求与重试', () => {
  beforeEach(() => vi.clearAllMocks())
  it('失败可重试，成功后清除错误', async () => {
    mocks.getDetail.mockRejectedValueOnce(new Error('网络异常')).mockResolvedValueOnce({ id: 700, questions: [] })
    const { result } = renderHook(() => useResultDetail('700'))
    await waitFor(() => expect(result.current.error).toBe('网络异常'))
    await act(async () => { await result.current.refetch() })
    expect(result.current.error).toBeNull()
    expect(result.current.data?.id).toBe(700)
  })
  it('切换成绩时忽略旧请求，立即隐藏旧成绩', async () => {
    let resolve!: (value: unknown) => void
    mocks.getDetail.mockReturnValueOnce(new Promise(r => { resolve = r })).mockResolvedValueOnce({ id: 701, questions: [] })
    const { result, rerender } = renderHook(({ id }) => useResultDetail(id), { initialProps: { id: '700' } })
    rerender({ id: '701' })
    await waitFor(() => expect(result.current.data?.id).toBe(701))
    await act(async () => resolve({ id: 700, questions: [] }))
    expect(result.current.data?.id).toBe(701)
  })
  it('无效编号不发起请求', async () => {
    const { result } = renderHook(() => useResultDetail('invalid'))
    await act(async () => { await result.current.refetch() })
    expect(mocks.getDetail).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toContain('编号无效')
  })
})
