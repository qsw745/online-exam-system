import assert from 'node:assert/strict'
import test from 'node:test'

import { PrivacyLifecycleAdminService, type PrivacyLifecycleAdminRepositoryContract } from './privacy-lifecycle-admin.service'

class MemoryAdminRepository implements PrivacyLifecycleAdminRepositoryContract {
  holds = new Map<string, any>()
  operations = new Map<string, { digest: string; result: any }>()
  paused = false
  async createHold(input: any) {
    const existing = this.holds.get(input.holdId)
    if (existing && existing.requestDigest !== input.requestDigest) throw Object.assign(new Error('冲突'), { code: 'LIFECYCLE_REQUEST_CONFLICT' })
    if (existing) return existing
    this.holds.set(input.holdId, input)
    return input
  }
  async findHoldReplay(dataRegion: string, holdId: string, requestDigest: string) {
    const existing = this.holds.get(holdId)
    if (!existing) return { found: false, result: null }
    if (existing.dataRegion !== dataRegion || existing.requestDigest !== requestDigest) {
      throw Object.assign(new Error('冲突'), { code: 'LIFECYCLE_REQUEST_CONFLICT' })
    }
    return { found: true, result: existing }
  }
  async findOperationReplay(_dataRegion: string, _operationType: string, operation: any) {
    const existing = this.operations.get(operation.operationId)
    if (!existing) return { found: false, result: null }
    if (existing.digest !== operation.requestDigest) {
      throw Object.assign(new Error('冲突'), { code: 'LIFECYCLE_REQUEST_CONFLICT' })
    }
    return { found: true, result: existing.result }
  }
  private replay(operation: { operationId: string; requestDigest: string }, result: any) {
    const existing = this.operations.get(operation.operationId)
    if (existing && existing.digest !== operation.requestDigest) {
      throw Object.assign(new Error('冲突'), { code: 'LIFECYCLE_REQUEST_CONFLICT' })
    }
    if (existing) return existing.result
    this.operations.set(operation.operationId, { digest: operation.requestDigest, result })
    return result
  }
  async releaseHold(dataRegion: string, holdId: string, operation: any) {
    const item = this.holds.get(holdId)
    const result = !item || item.dataRegion !== dataRegion ? null : { holdId, releasedAt: '2026-08-31T01:00:00.000Z' }
    return this.replay(operation, result)
  }
  async extendHold(dataRegion: string, holdId: string, operation: any, expiresAt: Date) {
    const item = this.holds.get(holdId)
    const result = !item || item.dataRegion !== dataRegion ? null : { holdId, expiresAt: expiresAt.toISOString() }
    return this.replay(operation, result)
  }
  async pauseRegion(_dataRegion: string, operation: any, _reason: string, reviewAt: Date) {
    this.paused = true
    return this.replay(operation, { paused: true, reviewAt: reviewAt.toISOString() })
  }
  async resumeRegion(_dataRegion: string, operation: any) {
    this.paused = false
    return this.replay(operation, { paused: false })
  }
  async retryStep(_dataRegion: string, stepId: string, operation: any) {
    return this.replay(operation, { stepId, status: 'PENDING' })
  }
  async listRequests() { return [] }
  async getRequest() { return null }
  async getDryRunContext(): Promise<any | null> { return null }
}

const service = (
  repository = new MemoryAdminRepository(),
  handlers = new Map(),
  now = () => new Date('2026-08-31T00:00:00.000Z'),
) => new PrivacyLifecycleAdminService({
  dataRegion: 'CN',
  repository,
  schemaAudit: { async inspect() { return { coveredColumnCount: 1, uncoveredColumnCount: 0, categoryCounts: {} } } },
  handlers,
  now,
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
    {
      operationId: 'e132689c-4a5d-42a2-86c5-3661e62d4d1f',
      reason: '数据库维护',
      reviewAt: '2026-08-31T02:00:00.000Z',
    },
  )
  await target.resumeRegion(
    { userId: 9, role: 'admin', dataRegion: 'CN' },
    { operationId: 'f132689c-4a5d-42a2-86c5-3661e62d4d1f' },
  )
  await assert.rejects(
    target.retryStep(
      { userId: 9, role: 'admin', dataRegion: 'CN' },
      'not-a-uuid',
      { operationId: 'a232689c-4a5d-42a2-86c5-3661e62d4d1f' },
    ),
    (error: any) => error.code === 'LIFECYCLE_UUID_INVALID',
  )
})

test('暂停和步骤重试在响应丢失后使用同一操作编号安全重放', async () => {
  const repository = new MemoryAdminRepository()
  const target = service(repository)
  const actor = { userId: 9, role: 'admin', dataRegion: 'CN' as const }
  const pause = {
    operationId: 'a332689c-4a5d-42a2-86c5-3661e62d4d1f',
    reason: '数据库维护',
    reviewAt: '2026-08-31T02:00:00.000Z',
  }
  const first = await target.pauseRegion(actor, pause)
  const replay = await target.pauseRegion(actor, pause)
  assert.deepEqual(replay, first)
  assert.equal(repository.operations.size, 1)

  const stepId = 'a432689c-4a5d-42a2-86c5-3661e62d4d1f'
  const operation = { operationId: 'a532689c-4a5d-42a2-86c5-3661e62d4d1f' }
  assert.deepEqual(await target.retryStep(actor, stepId, operation), await target.retryStep(actor, stepId, operation))
  assert.equal(repository.operations.size, 2)
})

test('同一管理操作编号不能用于不同请求内容', async () => {
  const target = service()
  const actor = { userId: 9, role: 'admin', dataRegion: 'CN' as const }
  const operationId = 'a632689c-4a5d-42a2-86c5-3661e62d4d1f'
  await target.pauseRegion(actor, {
    operationId,
    reason: '数据库维护',
    reviewAt: '2026-08-31T02:00:00.000Z',
  })
  await assert.rejects(
    target.pauseRegion(actor, {
      operationId,
      reason: '另一个原因',
      reviewAt: '2026-08-31T02:00:00.000Z',
    }),
    (error: any) => error.code === 'LIFECYCLE_REQUEST_CONFLICT',
  )
})

test('安全预演按类别与动作聚合多个处理器的数量', async () => {
  const repository = new MemoryAdminRepository()
  repository.getDryRunContext = async () => ({ userId: 12, policySnapshot: {} })
  const handler = (stepCode: string, count: number) => ({
    stepCode,
    async planCount() { return count },
    async processBatch() { throw new Error('预演不应执行处理') },
  })
  const handlers = new Map<string, any>([
    ['one', handler('anonymize_exam_archive', 3)],
    ['two', handler('anonymize_exam_archive', 5)],
  ])
  const target = service(repository, handlers)
  const result = await target.dryRun(
    { userId: 9, role: 'admin', dataRegion: 'CN' },
    { requestId: 'a732689c-4a5d-42a2-86c5-3661e62d4d1f' },
  )
  assert.deepEqual(result.categories, [{ category: 'EXAM_ARCHIVE', action: 'ANONYMIZE', count: 8 }])
})

test('冻结、延期和暂停在业务时间过去后仍可重放已提交结果', async () => {
  const repository = new MemoryAdminRepository()
  let current = new Date('2026-08-31T00:00:00.000Z')
  const target = service(repository, new Map(), () => current)
  const actor = { userId: 9, role: 'admin', dataRegion: 'CN' as const }
  const hold = {
    holdId: 'b832689c-4a5d-42a2-86c5-3661e62d4d1f',
    category: 'EXAM_ARCHIVE' as const,
    scopeType: 'USER_REQUEST' as const,
    scopeId: 'b932689c-4a5d-42a2-86c5-3661e62d4d1f',
    reasonCode: 'LEGAL_DISPUTE' as const,
    legalBasisReference: '案号 2026-08-31-02',
    expiresAt: '2026-09-01T00:00:00.000Z',
  }
  const created = await target.createHold(actor, hold)
  current = new Date('2026-09-02T00:00:00.000Z')
  assert.deepEqual(await target.createHold(actor, hold), created)

  current = new Date('2026-08-31T00:00:00.000Z')
  const extension = {
    operationId: 'ba32689c-4a5d-42a2-86c5-3661e62d4d1f',
    expiresAt: '2026-09-01T02:00:00.000Z',
  }
  const extended = await target.extendHold(actor, hold.holdId, extension)
  current = new Date('2026-09-02T00:00:00.000Z')
  assert.deepEqual(await target.extendHold(actor, hold.holdId, extension), extended)

  current = new Date('2026-08-31T00:00:00.000Z')
  const pause = {
    operationId: 'bb32689c-4a5d-42a2-86c5-3661e62d4d1f',
    reason: '数据库维护',
    reviewAt: '2026-08-31T02:00:00.000Z',
  }
  const paused = await target.pauseRegion(actor, pause)
  current = new Date('2026-08-31T03:00:00.000Z')
  assert.deepEqual(await target.pauseRegion(actor, pause), paused)
})
