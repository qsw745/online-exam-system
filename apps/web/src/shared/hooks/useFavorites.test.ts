import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFavorites } from './useFavorites'

const mocks = vi.hoisted(() => ({
  api: { list: vi.fn(), items: vi.fn(), remove: vi.fn(), removeItem: vi.fn(), share: vi.fn() },
  message: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}))
vi.mock('antd', () => ({ App: { useApp: () => ({ message: mocks.message }) } }))
vi.mock('@/shared/api/endpoints/favorites', () => ({ favoritesApi: mocks.api }))

function deferred() {
  let resolve!: (value: unknown) => void
  const promise = new Promise(r => { resolve = r })
  return { promise, resolve }
}

describe('收藏夹切换边界', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.api.list.mockResolvedValue([{ id: 1, name: '第一组' }, { id: 2, name: '第二组' }])
  })

  it('快速切换后旧题目不能串到新收藏夹，也不重复加载收藏夹列表', async () => {
    const old = deferred()
    mocks.api.items.mockReturnValueOnce(old.promise).mockResolvedValueOnce([{ id: 22, question_title: '第二组题目' }])
    const { result } = renderHook(() => useFavorites())
    await waitFor(() => expect(mocks.api.items).toHaveBeenCalledWith(1))
    act(() => result.current.setSelectedId(2))
    await waitFor(() => expect(result.current.items[0]?.id).toBe(22))
    await act(async () => old.resolve([{ id: 11, question_title: '第一组题目' }]))
    expect(result.current.selectedId).toBe(2)
    expect(result.current.items[0]?.id).toBe(22)
    expect(result.current.itemsLoading).toBe(false)
    expect(mocks.api.list).toHaveBeenCalledTimes(1)
  })

  it('删除完成时保留用户刚切换到的收藏夹', async () => {
    const removal = deferred()
    mocks.api.items.mockResolvedValue([])
    mocks.api.remove.mockReturnValue(removal.promise)
    const { result } = renderHook(() => useFavorites())
    await waitFor(() => expect(result.current.selectedId).toBe(1))
    let pending!: Promise<void>
    act(() => { pending = result.current.deleteFavorite(1) })
    act(() => result.current.setSelectedId(2))
    await act(async () => { removal.resolve(undefined); await pending })
    expect(result.current.selectedId).toBe(2)
    expect(result.current.favorites.map(f => f.id)).toEqual([2])
  })
  it('读取失败保留错误供重试，字符串 0 仍然是私有', async () => {
    mocks.api.list.mockRejectedValueOnce(new Error('读取中断')).mockResolvedValueOnce([{ id: 1, name: '私有', is_public: '0' }])
    mocks.api.items.mockResolvedValue([])
    const { result } = renderHook(() => useFavorites())
    await waitFor(() => expect(result.current.error).toBe('读取中断'))
    await act(async () => { await result.current.fetchFavorites() })
    expect(result.current.error).toBeNull()
    expect(result.current.favorites[0].is_public).toBe(false)
  })
  it('连续删除同一条目只写一次，数量只减少一次', async () => {
    const removal = deferred()
    mocks.api.list.mockResolvedValue([{ id: 1, items_count: 3 }])
    mocks.api.items.mockResolvedValue([{ id: 11 }])
    mocks.api.removeItem.mockReturnValue(removal.promise)
    const { result } = renderHook(() => useFavorites())
    await waitFor(() => expect(result.current.items).toHaveLength(1))
    act(() => { void result.current.removeItem(11); void result.current.removeItem(11) })
    expect(mocks.api.removeItem).toHaveBeenCalledTimes(1)
    await act(async () => removal.resolve(undefined))
    expect(result.current.favorites[0].items_count).toBe(2)
  })
  it('剪贴板拒绝时仍显示已生成的分享链接', async () => {
    mocks.api.items.mockResolvedValue([])
    mocks.api.share.mockResolvedValue('https://example.com/shared/favorites/demo')
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    const { result } = renderHook(() => useFavorites())
    await act(async () => { await result.current.shareFavorite(1) })
    expect(result.current.shareLink).toBe('https://example.com/shared/favorites/demo')
    expect(mocks.message.info).toHaveBeenCalled()
  })

})
