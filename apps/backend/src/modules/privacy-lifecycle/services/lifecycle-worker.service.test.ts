import assert from 'node:assert/strict'
import test from 'node:test'

import type {
  ClaimedLifecycleStep,
  LifecycleBatchCompletion,
  LifecycleHandler,
  LifecycleWorkerRepositoryContract,
} from './lifecycle-worker.service'
import { runLifecycleWorkerOnce } from './lifecycle-worker.service'
import {
  MemoryLifecycleMetrics,
  sanitizeLifecycleMetricLabels,
} from './lifecycle-observability'

const NOW = new Date('2026-08-31T08:00:00.000Z')
const STEP_ID = 'a132689c-4a5d-42a2-86c5-3661e62d4d1f'
const REQUEST_ID = 'b132689c-4a5d-42a2-86c5-3661e62d4d1f'

type StoredStep = ClaimedLifecycleStep & {
  leaseOwner: string | null
  leaseExpiresAt: Date | null
  nextAttemptAt: Date | null
}

class MemoryLifecycleWorkerRepository implements LifecycleWorkerRepositoryContract {
  readonly step: StoredStep
  paused = false
  parentStatus = 'SCHEDULED'
  takeovers = 0
  renewals = 0

  constructor() {
    this.step = {
      stepId: STEP_ID,
      stepCode: 'delete_auth_credentials',
      category: 'AUTH_CREDENTIALS',
      action: 'DELETE',
      dataRegion: 'CN',
      parent: { kind: 'ACCOUNT_DELETION', requestId: REQUEST_ID, userId: 7 },
      policySnapshot: null,
      cursor: null,
      plannedCount: 0,
      processedCount: 0,
      attemptCount: 0,
      status: 'PENDING',
      leaseOwner: null,
      leaseExpiresAt: null,
      nextAttemptAt: null,
    }
  }

  async releaseExpiredLeases(now: Date): Promise<number> {
    if (this.step.leaseExpiresAt && this.step.leaseExpiresAt <= now) {
      this.step.leaseOwner = null
      this.step.leaseExpiresAt = null
      this.step.status = 'RETRYING'
      this.takeovers += 1
      return 1
    }
    return 0
  }

  async isRegionPaused(): Promise<boolean> {
    return this.paused
  }

  async claimNextStep(workerId: string, now: Date, leaseMs: number): Promise<ClaimedLifecycleStep | null> {
    if (this.paused || this.step.status === 'COMPLETED' || this.step.status === 'HELD' || this.step.status === 'ATTENTION_REQUIRED') return null
    if (this.step.nextAttemptAt && this.step.nextAttemptAt > now) return null
    if (this.step.leaseExpiresAt && this.step.leaseExpiresAt > now) return null
    if (this.step.leaseExpiresAt && this.step.leaseExpiresAt <= now) this.takeovers += 1
    this.step.leaseOwner = workerId
    this.step.leaseExpiresAt = new Date(now.getTime() + leaseMs)
    this.step.status = 'RUNNING'
    return structuredClone(this.step)
  }

  async completeBatch(workerId: string, completion: LifecycleBatchCompletion): Promise<void> {
    if (this.step.leaseOwner !== workerId) throw Object.assign(new Error('租约冲突'), { code: 'LIFECYCLE_LEASE_CONFLICT' })
    const previous = Number((this.step.cursor as any)?.afterId ?? -1)
    const next = Number(completion.nextCursor?.afterId ?? previous)
    if (next < previous) throw Object.assign(new Error('游标不能倒退'), { code: 'LIFECYCLE_CURSOR_REGRESSION' })
    this.step.cursor = completion.nextCursor
    this.step.processedCount += completion.processedCount
    this.step.leaseOwner = null
    this.step.leaseExpiresAt = null
    this.step.status = completion.done ? 'COMPLETED' : 'PENDING'
    if (completion.done) this.parentStatus = 'COMPLETED'
  }

  async renewLease(workerId: string, stepId: string, now: Date, leaseMs: number): Promise<void> {
    if (this.step.leaseOwner !== workerId || this.step.stepId !== stepId) {
      throw Object.assign(new Error('租约冲突'), { code: 'LIFECYCLE_LEASE_CONFLICT' })
    }
    this.step.leaseExpiresAt = new Date(now.getTime() + leaseMs)
    this.renewals += 1
  }

  async markRetry(workerId: string, input: { stepId: string; errorCode: string; now: Date; maxAttempts: number }): Promise<'RETRYING' | 'ATTENTION_REQUIRED'> {
    if (this.step.leaseOwner !== workerId || this.step.stepId !== input.stepId) {
      throw Object.assign(new Error('租约冲突'), { code: 'LIFECYCLE_LEASE_CONFLICT' })
    }
    this.step.attemptCount += 1
    this.step.leaseOwner = null
    this.step.leaseExpiresAt = null
    if (this.step.attemptCount >= input.maxAttempts) {
      this.step.status = 'ATTENTION_REQUIRED'
      this.parentStatus = 'ATTENTION_REQUIRED'
      return 'ATTENTION_REQUIRED'
    }
    this.step.status = 'RETRYING'
    this.step.nextAttemptAt = new Date(input.now.getTime() + 1_000 * 2 ** (this.step.attemptCount - 1))
    this.parentStatus = 'RETRYING'
    return 'RETRYING'
  }

  async markAttention(workerId: string, stepId: string): Promise<void> {
    if (this.step.leaseOwner !== workerId || this.step.stepId !== stepId) {
      throw Object.assign(new Error('租约冲突'), { code: 'LIFECYCLE_LEASE_CONFLICT' })
    }
    this.step.status = 'ATTENTION_REQUIRED'
    this.step.leaseOwner = null
    this.step.leaseExpiresAt = null
    this.parentStatus = 'ATTENTION_REQUIRED'
  }
}

const successfulHandler = (overrides: Partial<LifecycleHandler> = {}): LifecycleHandler => ({
  stepCode: 'delete_auth_credentials',
  category: 'AUTH_CREDENTIALS',
  async planCount() { return 2 },
  async executeBatch() {
    return { processedCount: 2, nextCursor: { afterId: 12 }, done: true }
  },
  ...overrides,
})

test('两个 Worker 不能同时执行同一步骤，租约过期后可接管', async () => {
  const repository = new MemoryLifecycleWorkerRepository()
  const first = await repository.claimNextStep('worker-a', NOW, 30_000)
  const second = await repository.claimNextStep('worker-b', NOW, 30_000)
  assert.equal(first?.stepId, STEP_ID)
  assert.equal(second, null)
  const takeover = await repository.claimNextStep('worker-b', new Date(NOW.getTime() + 30_001), 30_000)
  assert.equal(takeover?.stepId, STEP_ID)
  assert.equal(repository.takeovers, 1)
})

test('批次完成校验租约且游标只能前进', async () => {
  const repository = new MemoryLifecycleWorkerRepository()
  await repository.claimNextStep('worker-a', NOW, 30_000)
  await assert.rejects(
    repository.completeBatch('worker-b', { stepId: STEP_ID, processedCount: 1, nextCursor: { afterId: 5 }, done: false }),
    (error: any) => error.code === 'LIFECYCLE_LEASE_CONFLICT',
  )
  await repository.completeBatch('worker-a', { stepId: STEP_ID, processedCount: 1, nextCursor: { afterId: 5 }, done: false })
  await repository.claimNextStep('worker-a', new Date(NOW.getTime() + 1), 30_000)
  await assert.rejects(
    repository.completeBatch('worker-a', { stepId: STEP_ID, processedCount: 1, nextCursor: { afterId: 4 }, done: false }),
    (error: any) => error.code === 'LIFECYCLE_CURSOR_REGRESSION',
  )
})

test('单轮 Worker 完成一步并只记录低基数指标', async () => {
  const repository = new MemoryLifecycleWorkerRepository()
  const metrics = new MemoryLifecycleMetrics()
  const result = await runLifecycleWorkerOnce({
    repository,
    handlers: new Map([['delete_auth_credentials', successfulHandler()]]),
    metrics,
    workerId: 'worker-a',
    dataRegion: 'CN',
    now: NOW,
    leaseMs: 30_000,
    batchSize: 100,
  })
  assert.deepEqual(result, { claimed: 1, completed: 1, retried: 0, attentionRequired: 0, paused: false })
  assert.equal(repository.step.status, 'COMPLETED')
  assert.equal(repository.renewals, 1)
  assert.equal(metrics.events.every(event => !('requestId' in event.labels) && !('userId' in event.labels)), true)
})

test('可恢复错误指数退避，五次失败进入人工关注', async () => {
  const repository = new MemoryLifecycleWorkerRepository()
  const handler = successfulHandler({
    async executeBatch() {
      throw Object.assign(new Error('暂时失败'), { code: 'LIFECYCLE_STORAGE_TEMPORARY' })
    },
  })
  let now = NOW
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const result = await runLifecycleWorkerOnce({
      repository,
      handlers: new Map([[handler.stepCode, handler]]),
      metrics: new MemoryLifecycleMetrics(),
      workerId: 'worker-a',
      dataRegion: 'CN',
      now,
      leaseMs: 30_000,
      batchSize: 100,
      maxAttempts: 5,
    })
    if (attempt < 5) {
      assert.equal(result.retried, 1)
      assert.equal(repository.step.nextAttemptAt?.getTime(), now.getTime() + 1_000 * 2 ** (attempt - 1))
      now = new Date(repository.step.nextAttemptAt!.getTime())
    } else {
      assert.equal(result.attentionRequired, 1)
      assert.equal(repository.step.status, 'ATTENTION_REQUIRED')
      assert.equal(repository.parentStatus, 'ATTENTION_REQUIRED')
    }
  }
})

test('全局暂停和合法冻结步骤都不会被认领', async () => {
  const repository = new MemoryLifecycleWorkerRepository()
  repository.paused = true
  const paused = await runLifecycleWorkerOnce({
    repository,
    handlers: new Map(),
    metrics: new MemoryLifecycleMetrics(),
    workerId: 'worker-a', dataRegion: 'CN', now: NOW, leaseMs: 30_000, batchSize: 100,
  })
  assert.equal(paused.paused, true)
  repository.paused = false
  repository.step.status = 'HELD'
  const held = await repository.claimNextStep('worker-a', NOW, 30_000)
  assert.equal(held, null)
})

test('未知处理器失败关闭，指标禁止主体和高基数标签', async () => {
  const repository = new MemoryLifecycleWorkerRepository()
  const result = await runLifecycleWorkerOnce({
    repository,
    handlers: new Map(),
    metrics: new MemoryLifecycleMetrics(),
    workerId: 'worker-a', dataRegion: 'CN', now: NOW, leaseMs: 30_000, batchSize: 100,
  })
  assert.equal(result.attentionRequired, 1)
  assert.equal(repository.step.status, 'ATTENTION_REQUIRED')
  assert.throws(
    () => sanitizeLifecycleMetricLabels({ dataRegion: 'CN', requestId: REQUEST_ID }),
    (error: any) => error.code === 'LIFECYCLE_METRIC_LABEL_FORBIDDEN',
  )
})
