import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTaskById } from './useTaskById'
import { useTasksQuery } from './useTasksQuery'

const mocks = vi.hoisted(() => ({ getById: vi.fn(), listMine: vi.fn(), message: { error: vi.fn() } }))
vi.mock('antd', () => ({ App: { useApp: () => ({ message: mocks.message }) } }))
vi.mock('@/shared/api/endpoints/tasks', () => ({ tasksApi: mocks }))
vi.mock('@/shared/api/http', () => ({ isSuccess: (r: any) => r?.success === true }))

function deferred() {
  let resolve!: (value: unknown) => void
  const promise = new Promise(r => { resolve = r })
  return { promise, resolve }
}

describe('移动任务请求边界', () => {
  beforeEach(() => vi.clearAllMocks())

  it('旧详情晚返回不能覆盖新任务', async () => {
    const old = deferred()
    mocks.getById.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ success: true, data: { id: '2', title: '新任务' } })
    const { result, rerender } = renderHook(({ id }) => useTaskById(id), { initialProps: { id: '1' } })
    rerender({ id: '2' })
    await waitFor(() => expect(result.current.task?.id).toBe('2'))
    await act(async () => old.resolve({ success: true, data: { id: '1', title: '旧任务' } }))
    expect(result.current.task?.id).toBe('2')
  })

  it('无效 ID 不请求后端；失败信封不当作任务，重试后恢复', async () => {
    mocks.getById.mockResolvedValueOnce({ success: false, error: '无权访问' })
      .mockResolvedValueOnce({ success: true, data: { id: '1' } })
    const { result, rerender } = renderHook(({ id }) => useTaskById(id), { initialProps: { id: 'invalid' } })
    expect(mocks.getById).not.toHaveBeenCalled()
    expect(result.current.error).toBeTruthy()
    rerender({ id: '1' })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.task).toBeNull()
    expect(result.current.error).toBeTruthy()
    await act(async () => { await result.current.refetch() })
    expect(result.current.task?.id).toBe('1')
    expect(result.current.error).toBeNull()
  })

  it('快速搜索时忽略旧列表响应', async () => {
    const old = deferred()
    mocks.listMine.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ success: true, data: { items: [{ id: '2' }], total: 1 } })
    const { result } = renderHook(() => useTasksQuery(10, { scope: 'mine' }))
    act(() => result.current.search({ keyword: '最新' }))
    await waitFor(() => expect(result.current.rows[0]?.id).toBe('2'))
    await act(async () => old.resolve({ success: true, data: { items: [{ id: '1' }], total: 50 } }))
    expect(result.current.rows[0]?.id).toBe('2')
    expect(result.current.total).toBe(1)
    expect(result.current.loading).toBe(false)
  })

  it('列表失败和无任务可区分，并可重试恢复', async () => {
    mocks.listMine.mockResolvedValueOnce({ success: false, error: '网络暂不可用' })
      .mockResolvedValueOnce({ success: true, data: { items: [], total: 0 } })
    const { result } = renderHook(() => useTasksQuery(10, { scope: 'mine' }))
    await waitFor(() => expect(result.current.error).toBe('网络暂不可用'))
    await act(async () => { await result.current.refetch() })
    expect(result.current.error).toBeNull()
    expect(result.current.rows).toEqual([])
  })
})
