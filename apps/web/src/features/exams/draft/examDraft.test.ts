import { describe, expect, it, vi } from 'vitest'
import { createWebExamVault } from '@/platform/exam-vault'
import { clearExamDraft, examDraftKey, readExamDraft, saveExamDraft } from './examDraft'

export class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

const attemptId = '6745d94e-7d93-4a39-b348-26d8a979ee7d'
const alice = { userId: 7, taskId: 11, examId: 13, attemptId }
const bob = { userId: 8, taskId: 11, examId: 13, attemptId }
const state = { answers: { '101': 'A', '102': 'B,C' }, flagged: [102] }
const savedAt = '2026-08-30T10:00:00.000Z'

describe('考试草稿存储', () => {
  it('按用户、任务、考试和作答编号生成隔离键', () => {
    expect(examDraftKey(alice)).toBe(`wenheng:exam-draft:v2:7:11:13:${attemptId}`)
    expect(examDraftKey(bob)).toBe(`wenheng:exam-draft:v2:8:11:13:${attemptId}`)
  })

  it('保存并恢复带版本和时间的草稿', async () => {
    const storage = createWebExamVault(new MemoryStorage())
    expect(await saveExamDraft(storage, alice, state, () => savedAt)).toEqual({ ok: true, savedAt })
    expect(await readExamDraft(storage, alice)).toEqual({
      status: 'found',
      draft: { version: 2, ...alice, ...state, savedAt },
    })
  })

  it('保存并恢复同一编号的待提交快照', async () => {
    const storage = createWebExamVault(new MemoryStorage())
    const pendingSubmission = {
      attemptId,
      submissionId: 'cd60e7f2-eed8-42df-88f5-2b86d5504d8c',
      answers: { '101': 'A' },
      timeSpent: 45,
      reason: 'deadline' as const,
      createdAt: savedAt,
    }
    await saveExamDraft(storage, alice, { ...state, pendingSubmission }, () => savedAt)
    expect(await readExamDraft(storage, alice)).toMatchObject({
      status: 'found',
      draft: { pendingSubmission },
    })
  })

  it('损坏草稿会被移除', async () => {
    const memory = new MemoryStorage()
    const storage = createWebExamVault(memory)
    memory.setItem(examDraftKey(alice), '{bad json')
    expect(await readExamDraft(storage, alice)).toEqual({ status: 'invalid' })
    expect(memory.getItem(examDraftKey(alice))).toBeNull()
  })

  it('旧版本或身份不匹配的草稿会被移除', async () => {
    const memory = new MemoryStorage()
    const storage = createWebExamVault(memory)
    memory.setItem(examDraftKey(alice), JSON.stringify({ version: 1, ...alice, ...state, savedAt }))
    expect(await readExamDraft(storage, alice)).toEqual({ status: 'invalid' })
    memory.setItem(examDraftKey(alice), JSON.stringify({ version: 2, ...bob, ...state, savedAt }))
    expect(await readExamDraft(storage, alice)).toEqual({ status: 'invalid' })
  })

  it('存储不可访问时返回 unavailable 而不抛错', async () => {
    const memory = new MemoryStorage()
    vi.spyOn(memory, 'getItem').mockImplementation(() => { throw new DOMException('denied', 'SecurityError') })
    expect(await readExamDraft(createWebExamVault(memory), alice)).toEqual({ status: 'unavailable' })
  })

  it('写入失败时返回失败而不抛错', async () => {
    const memory = new MemoryStorage()
    vi.spyOn(memory, 'setItem').mockImplementation(() => { throw new DOMException('quota', 'QuotaExceededError') })
    expect(await saveExamDraft(createWebExamVault(memory), alice, state)).toEqual({ ok: false })
  })

  it('只清除指定考试草稿', async () => {
    const storage = createWebExamVault(new MemoryStorage())
    await saveExamDraft(storage, alice, state)
    await saveExamDraft(storage, bob, state)
    expect(await clearExamDraft(storage, alice)).toBe(true)
    expect(await readExamDraft(storage, alice)).toEqual({ status: 'missing' })
    expect((await readExamDraft(storage, bob)).status).toBe('found')
  })
})
