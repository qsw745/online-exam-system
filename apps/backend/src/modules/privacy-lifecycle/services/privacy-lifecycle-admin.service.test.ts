import assert from 'node:assert/strict'
import test from 'node:test'

import { PrivacyLifecycleAdminService, type PrivacyLifecycleAdminRepositoryContract } from './privacy-lifecycle-admin.service'

class MemoryAdminRepository implements PrivacyLifecycleAdminRepositoryContract {
  holds = new Map<string, any>()
  paused = false
  async createHold(input: any) {
    const existing = this.holds.get(input.holdId)
    if (existing && existing.requestDigest !== input.requestDigest) throw Object.assign(new Error('冲突'), { code: 'LIFECYCLE_REQUEST_CONFLICT' })
    if (existing) return existing
    this.holds.set(input.holdId, input)
    return input
  }
  async releaseHold(dataRegion: string, holdId: string) { const item = this.holds.get(holdId); if (!item || item.dataRegion !== dataRegion) return null; item.releasedAt = '2026-08-31T01:00:00.000Z'; return item }
  async extendHold(dataRegion: string, holdId: string, expiresAt: Date) { const item = this.holds.get(holdId); if (!item || item.dataRegion !== dataRegion) return null; item.expiresAt = expiresAt.toISOString(); return item }
  async pauseRegion() { this.paused = true }
  async resumeRegion() { this.paused = false }
  async retryStep() { return true }
  async listRequests() { return [] }
  async getRequest() { return null }
}

const service = () => new PrivacyLifecycleAdminService({
  dataRegion: 'CN',
  repository: new MemoryAdminRepository(),
  schemaAudit: { async inspect() { return { coveredColumnCount: 1, uncoveredColumnCount: 0, categoryCounts: {} } } },
  handlers: new Map(),
  now: () => new Date('2026-08-31T00:00:00.000Z'),
})

test('只有同区域管理员可以创建冻结且 UUID 幂等冲突稳定', async () => {
  const target = service()
  const input = {
    holdId: 'a132689c-4a5d-42a2-86c5-3661e62d4d1f', category: 'EXAM_ARCHIVE' as const,
    scopeType: 'USER_REQUEST' as const, scopeId: 'b132689c-4a5d-42a2-86c5-3661e62d4d1f',
    reasonCode: 'LEGAL_DISPUTE' as const, legalBasisReference: '案号 2026-08-31-01',
    expiresAt: '2026-09-30T00:00:00.000Z',
  }
  const first = await target.createHold({ userId: 9, role: 'admin', dataRegion: 'CN' }, input)
  const replay = await target.createHold({ userId: 9, role: 'admin', dataRegion: 'CN' }, input)
  assert.equal(first.holdId, replay.holdId)
  await assert.rejects(target.createHold({ userId: 9, role: 'teacher', dataRegion: 'CN' }, input), (error: any) => error.code === 'FORBIDDEN')
  await assert.rejects(target.createHold({ userId: 9, role: 'admin', dataRegion: 'GLOBAL' }, input), (error: any) => error.code === 'NOT_FOUND')
})

test('暂停必须有原因和复核时间，恢复不能强制完成步骤', async () => {
  const target = service()
  await target.pauseRegion(
    { userId: 9, role: 'admin', dataRegion: 'CN' },
    { reason: '数据库维护', reviewAt: '2026-08-31T02:00:00.000Z' },
  )
  await target.resumeRegion({ userId: 9, role: 'admin', dataRegion: 'CN' })
  await assert.rejects(
    target.retryStep({ userId: 9, role: 'admin', dataRegion: 'CN' }, 'not-a-uuid'),
    (error: any) => error.code === 'LIFECYCLE_UUID_INVALID',
  )
})
