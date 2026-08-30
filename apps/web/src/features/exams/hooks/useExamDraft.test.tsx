import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readExamDraft, saveExamDraft } from '../draft/examDraft'
import { useExamDraft } from './useExamDraft'

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

const identity = { userId: 3, taskId: 4, examId: 5 }
const savedAt = '2026-08-30T10:00:00.000Z'

describe('useExamDraft', () => {
  let storage: MemoryStorage

  beforeEach(() => {
    storage = new MemoryStorage()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('恢复匹配草稿并向页面返回答案和标记题', () => {
    saveExamDraft(storage, identity, { answers: { '5': 'A' }, flagged: [5] }, () => savedAt)
    const onRestore = vi.fn()
    const { result } = renderHook(() =>
      useExamDraft({ identity, answers: {}, flagged: [], storage, onRestore }),
    )
    expect(onRestore).toHaveBeenCalledWith({ answers: { '5': 'A' }, flagged: [5] })
    expect(result.current.status).toBe('restored')
    expect(result.current.savedAt).toBe(savedAt)
  })

  it('答案变化 499 毫秒时不写入，500 毫秒时写入', () => {
    const { rerender } = renderHook(
      ({ answers }) => useExamDraft({ identity, answers, flagged: [], storage }),
      { initialProps: { answers: {} as Record<string, string> } },
    )
    rerender({ answers: { '5': 'B' } })
    act(() => vi.advanceTimersByTime(499))
    expect(readExamDraft(storage, identity).status).toBe('missing')
    act(() => vi.advanceTimersByTime(1))
    expect(readExamDraft(storage, identity)).toMatchObject({
      status: 'found',
      draft: { answers: { '5': 'B' } },
    })
  })

  it('同一状态只写入一次，不被保存状态更新循环触发', () => {
    const setItem = vi.spyOn(storage, 'setItem')
    renderHook(() => useExamDraft({ identity, answers: { '5': 'B' }, flagged: [5], storage }))
    act(() => vi.advanceTimersByTime(1500))
    expect(setItem).toHaveBeenCalledTimes(1)
  })

  it('clearDraft 删除草稿并取消等待中的写入', () => {
    const { result } = renderHook(() =>
      useExamDraft({ identity, answers: { '5': 'C' }, flagged: [], storage }),
    )
    act(() => result.current.clearDraft())
    act(() => vi.advanceTimersByTime(500))
    expect(readExamDraft(storage, identity)).toEqual({ status: 'missing' })
  })

  it('pagehide 会立即写入尚未到期的草稿', () => {
    renderHook(() => useExamDraft({ identity, answers: { '5': 'D' }, flagged: [5], storage }))
    act(() => window.dispatchEvent(new Event('pagehide')))
    expect(readExamDraft(storage, identity)).toMatchObject({
      status: 'found',
      draft: { answers: { '5': 'D' }, flagged: [5] },
    })
  })

  it('存储写入失败时报告 unavailable', () => {
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    const { result } = renderHook(() =>
      useExamDraft({ identity, answers: { '5': 'E' }, flagged: [], storage }),
    )
    act(() => vi.advanceTimersByTime(500))
    expect(result.current.status).toBe('unavailable')
  })
})
