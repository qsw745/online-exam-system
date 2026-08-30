import { describe, expect, it, vi } from 'vitest'
import { clearExamDraft, examDraftKey, readExamDraft, saveExamDraft } from './examDraft'

export class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  clear() {
    this.values.clear()
  }

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

const alice = { userId: 7, taskId: 11, examId: 13 }
const bob = { userId: 8, taskId: 11, examId: 13 }
const state = { answers: { '101': 'A', '102': 'B,C' }, flagged: [102] }
const savedAt = '2026-08-30T10:00:00.000Z'

describe('考试草稿存储', () => {
  it('按用户、任务、考试生成隔离键', () => {
    expect(examDraftKey(alice)).toBe('wenheng:exam-draft:v1:7:11:13')
    expect(examDraftKey(bob)).toBe('wenheng:exam-draft:v1:8:11:13')
  })

  it('保存并恢复带版本和时间的草稿', () => {
    const storage = new MemoryStorage()
    expect(saveExamDraft(storage, alice, state, () => savedAt)).toEqual({ ok: true, savedAt })
    expect(readExamDraft(storage, alice)).toEqual({
      status: 'found',
      draft: { version: 1, ...alice, ...state, savedAt },
    })
  })

  it('损坏草稿会被移除', () => {
    const storage = new MemoryStorage()
    storage.setItem(examDraftKey(alice), '{bad json')
    expect(readExamDraft(storage, alice)).toEqual({ status: 'invalid' })
    expect(storage.getItem(examDraftKey(alice))).toBeNull()
  })

  it('旧版本或身份不匹配的草稿会被移除', () => {
    const storage = new MemoryStorage()
    storage.setItem(examDraftKey(alice), JSON.stringify({ version: 0, ...alice, ...state, savedAt }))
    expect(readExamDraft(storage, alice)).toEqual({ status: 'invalid' })
    storage.setItem(examDraftKey(alice), JSON.stringify({ version: 1, ...bob, ...state, savedAt }))
    expect(readExamDraft(storage, alice)).toEqual({ status: 'invalid' })
  })

  it('数据字段无效时拒绝草稿', () => {
    const storage = new MemoryStorage()
    storage.setItem(examDraftKey(alice), JSON.stringify({ version: 1, ...alice, answers: [], flagged: ['102'], savedAt: 'never' }))
    expect(readExamDraft(storage, alice)).toEqual({ status: 'invalid' })
  })

  it('存储不可访问时返回 unavailable 而不抛错', () => {
    const storage = new MemoryStorage()
    vi.spyOn(storage, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    expect(readExamDraft(storage, alice)).toEqual({ status: 'unavailable' })
  })

  it('写入失败时返回失败而不抛错', () => {
    const storage = new MemoryStorage()
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    expect(saveExamDraft(storage, alice, state)).toEqual({ ok: false })
  })

  it('只清除指定考试草稿', () => {
    const storage = new MemoryStorage()
    saveExamDraft(storage, alice, state)
    saveExamDraft(storage, bob, state)
    expect(clearExamDraft(storage, alice)).toBe(true)
    expect(readExamDraft(storage, alice)).toEqual({ status: 'missing' })
    expect(readExamDraft(storage, bob).status).toBe('found')
  })
})
