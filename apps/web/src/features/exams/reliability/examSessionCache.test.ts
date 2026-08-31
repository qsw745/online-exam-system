import { describe, expect, it } from 'vitest'
import { createWebExamVault } from '@/platform/exam-vault'

import {
  readExamSession,
  restoreCachedServerNow,
  saveExamSession,
} from './examSessionCache'

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

const payload = {
  taskId: 11,
  examId: 13,
  attemptId: '6745d94e-7d93-4a39-b348-26d8a979ee7d',
  serverNow: '2026-08-30T08:00:00.000Z',
  deadlineAt: '2026-08-30T09:00:00.000Z',
  questions: [{ id: 1, content: '题目' }],
}

describe('加密考试会话快照', () => {
  it('按用户和进入考试时的路由编号保存并恢复题目与作答身份', async () => {
    const storage = createWebExamVault(new MemoryStorage())
    await expect(saveExamSession(storage, { userId: 7, routeId: 11 }, payload, 50_000)).resolves.toBe(true)
    await expect(readExamSession<typeof payload>(storage, { userId: 7, routeId: 11 })).resolves.toMatchObject({
      status: 'found',
      session: { version: 1, userId: 7, routeId: 11, payload, deviceUptimeMs: 50_000 },
    })
  })

  it('离线重启后用设备持续运行时间推进服务端时间', () => {
    expect(restoreCachedServerNow('2026-08-30T08:00:00.000Z', 50_000, 80_500)).toEqual({
      ok: true,
      serverNow: '2026-08-30T08:00:30.500Z',
    })
  })

  it('设备已重启时拒绝使用失效计时基准', () => {
    expect(restoreCachedServerNow('2026-08-30T08:00:00.000Z', 50_000, 1_000)).toEqual({
      ok: false,
      reason: 'device_restarted',
    })
  })
})
