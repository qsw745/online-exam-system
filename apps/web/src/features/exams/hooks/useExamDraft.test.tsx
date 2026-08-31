import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWebExamVault, type ExamVaultAdapter } from '@/platform/exam-vault'
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

const identity = {
  userId: 3,
  taskId: 4,
  examId: 5,
  attemptId: '6745d94e-7d93-4a39-b348-26d8a979ee7d',
}
const savedAt = '2026-08-30T10:00:00.000Z'

async function flushPromises() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('useExamDraft', () => {
  let memory: MemoryStorage
  let storage: ExamVaultAdapter

  beforeEach(() => {
    memory = new MemoryStorage()
    storage = createWebExamVault(memory)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('恢复匹配草稿并向页面返回答案、标记题和待提交快照', async () => {
    const pendingSubmission = {
      attemptId: identity.attemptId,
      submissionId: 'cd60e7f2-eed8-42df-88f5-2b86d5504d8c',
      answers: { '5': 'A' },
      timeSpent: 50,
      reason: 'deadline' as const,
      createdAt: savedAt,
    }
    await saveExamDraft(
      storage,
      identity,
      { answers: { '5': 'A' }, flagged: [5], pendingSubmission },
      () => savedAt,
    )
    const onRestore = vi.fn()
    const { result } = renderHook(() =>
      useExamDraft({ identity, answers: {}, flagged: [], storage, onRestore }),
    )
    await act(flushPromises)
    expect(onRestore).toHaveBeenCalledWith({
      answers: { '5': 'A' },
      flagged: [5],
      pendingSubmission,
    })
    expect(result.current.status).toBe('restored')
    expect(result.current.savedAt).toBe(savedAt)
  })

  it('答案变化 499 毫秒时不写入，500 毫秒时写入', async () => {
    const { rerender } = renderHook(
      ({ answers }) => useExamDraft({ identity, answers, flagged: [], storage }),
      { initialProps: { answers: {} as Record<string, string> } },
    )
    await act(flushPromises)
    rerender({ answers: { '5': 'B' } })
    act(() => vi.advanceTimersByTime(499))
    expect((await readExamDraft(storage, identity)).status).toBe('missing')
    act(() => vi.advanceTimersByTime(1))
    await act(flushPromises)
    expect(await readExamDraft(storage, identity)).toMatchObject({
      status: 'found',
      draft: { answers: { '5': 'B' } },
    })
  })

  it('同一状态只写入一次，不被保存状态更新循环触发', async () => {
    const setItem = vi.spyOn(memory, 'setItem')
    renderHook(() => useExamDraft({ identity, answers: { '5': 'B' }, flagged: [5], storage }))
    await act(flushPromises)
    act(() => vi.advanceTimersByTime(1500))
    await act(flushPromises)
    expect(setItem).toHaveBeenCalledTimes(1)
  })

  it('clearDraft 删除草稿并取消等待中的写入', async () => {
    const { result } = renderHook(() =>
      useExamDraft({ identity, answers: { '5': 'C' }, flagged: [], storage }),
    )
    await act(flushPromises)
    await act(async () => { await result.current.clearDraft() })
    act(() => vi.advanceTimersByTime(500))
    await act(flushPromises)
    expect(await readExamDraft(storage, identity)).toEqual({ status: 'missing' })
  })

  it('pagehide 会立即写入尚未到期的草稿', async () => {
    renderHook(() => useExamDraft({ identity, answers: { '5': 'D' }, flagged: [5], storage }))
    await act(flushPromises)
    window.dispatchEvent(new Event('pagehide'))
    await act(flushPromises)
    expect(await readExamDraft(storage, identity)).toMatchObject({
      status: 'found',
      draft: { answers: { '5': 'D' }, flagged: [5] },
    })
  })

  it('存储写入失败时报告 unavailable', async () => {
    vi.spyOn(memory, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    const { result } = renderHook(() =>
      useExamDraft({ identity, answers: { '5': 'E' }, flagged: [], storage }),
    )
    await act(flushPromises)
    act(() => vi.advanceTimersByTime(500))
    await act(flushPromises)
    expect(result.current.status).toBe('unavailable')
  })
})
