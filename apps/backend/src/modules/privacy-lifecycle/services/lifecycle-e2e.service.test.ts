import assert from 'node:assert/strict'
import test from 'node:test'

import HttpError from '@/common/errors/http-error'
import {
  ACCOUNT_DELETION_STEPS,
  type AccountDeletionRecord,
  type AccountDeletionRepositoryContract,
  type AccountDeletionStepProjection,
  type AccountDeletionUser,
  type CreateDeletionRequestInput,
  type CreateDeletionRequestResult,
} from '@/modules/account/domain/account-deletion.model'
import { AccountDeletionService } from '@/modules/account/services/account-deletion.service'
import { assertLifecycleSchemaCovered, LifecycleDatasetCoverageError } from '../domain/data-handler.registry'
import { deriveLifecycleStatus } from '../domain/lifecycle.policy'
import type { DeletionMode, LifecycleCategoryCode } from '../domain/lifecycle.model'
import {
  createManifestEntry,
  MemoryDeletionManifestSink,
  replayDeletionManifest,
} from './deletion-manifest.service'
import { MemoryLifecycleMetrics } from './lifecycle-observability'
import {
  runLifecycleWorkerOnce,
  type ClaimedLifecycleStep,
  type LifecycleBatchCompletion,
  type LifecycleHandler,
  type LifecycleWorkerRepositoryContract,
  type LifecycleWorkerRunSummary,
} from './lifecycle-worker.service'
import { isRetentionEligible } from './retention-scan.service'

const REQUEST_ID = 'd132689c-4a5d-42a2-86c5-3661e62d4d1f'
const PUBLIC_ID = 'fa0d8c4e-4fd0-4f56-99aa-3f089d0e474a'
const STATUS_TOKEN = Buffer.alloc(32, 17).toString('base64url')
const MANIFEST_KEY = Buffer.alloc(32, 23)

type StoredStep = Omit<AccountDeletionStepProjection, 'plannedCount' | 'processedCount' | 'lastErrorCode'> & {
  plannedCount: number
  processedCount: number
  lastErrorCode: string | null
  stepId: string
  leaseOwner: string | null
  leaseExpiresAt: Date | null
  nextAttemptAt: Date | null
}

const clone = <T>(value: T): T => structuredClone(value)

class TransactionalMemoryLifecycleSystem implements AccountDeletionRepositoryContract, LifecycleWorkerRepositoryContract {
  now = new Date('2026-08-31T08:00:00.000Z')
  user: AccountDeletionUser | null = {
    id: 7,
    email: 'user@example.com',
    passwordHash: 'stored-password-hash',
    dataRegion: 'CN',
    accountType: 'PERSONAL',
    deletionStatus: 'ACTIVE',
  }
  record: AccountDeletionRecord | null = null
  steps: StoredStep[] = []
  authCredentialCount = 2
  faceCredentialCount = 1
  examArchive = { userId: 7 as number | null, anonymousSubjectId: null as string | null }
  proctoring = { userId: 7 as number | null, anonymousSubjectId: null as string | null }
  receipt: Record<string, unknown> | null = null
  activeHoldUntil: Date | null = null
  manifestSynced = false
  readonly manifest = new MemoryDeletionManifestSink()
  readonly outbox = { recipientEnvelope: 'encrypted-recipient', payloadEnvelope: 'encrypted-payload', status: 'BLOCKED' }
  readonly revokedSessions: string[] = []
  readonly handlers = new Map<string, LifecycleHandler>()
  readonly failOnce = new Set<string>()

  constructor() {
    for (const plan of ACCOUNT_DELETION_STEPS) {
      this.handlers.set(plan.stepCode, this.handler(plan.stepCode, plan.category))
    }
  }

  readonly account = new AccountDeletionService(this, () => this.now, {
    verifyPassword: (plain, hash) => plain === 'correct-password' && hash === 'stored-password-hash',
    revokeSession: async sessionId => { this.revokedSessions.push(sessionId) },
  })

  private snapshot(): AccountDeletionRecord | null {
    if (!this.record) return null
    this.record.steps = this.steps.map(step => ({
      stepCode: step.stepCode,
      category: step.category,
      action: step.action,
      status: step.status,
      plannedCount: step.plannedCount,
      processedCount: step.processedCount,
      attemptCount: step.attemptCount,
      lastErrorCode: step.lastErrorCode,
    }))
    return clone(this.record)
  }

  private syncParent(): void {
    if (!this.record || this.record.status === 'CANCELLED') return
    this.record.status = deriveLifecycleStatus(this.steps.map(step => ({ status: step.status, action: step.action })))
    if (this.record.status === 'RUNNING' && !this.record.startedAt) this.record.startedAt = this.now.toISOString()
    if (this.record.status === 'COMPLETED' || this.record.status === 'COMPLETED_WITH_RESTRICTED_RETENTION') {
      this.record.completedAt ??= this.now.toISOString()
      this.record.restrictedRetentionUntil = this.activeHoldUntil?.toISOString() ?? null
    }
  }

  private handler(stepCode: string, category: LifecycleCategoryCode): LifecycleHandler {
    return {
      stepCode,
      category,
      planCount: async () => 1,
      executeBatch: async () => {
        if (this.failOnce.delete(stepCode)) {
          throw Object.assign(new Error('隔离存储暂时不可用'), { code: 'LIFECYCLE_STORAGE_TEMPORARY' })
        }
        switch (stepCode) {
          case 'delete_auth_credentials':
            this.authCredentialCount = 0
            break
          case 'delete_face_credentials':
            this.faceCredentialCount = 0
            break
          case 'anonymize_exam_archive':
            this.examArchive = { userId: null, anonymousSubjectId: '0132689c-4a5d-42a2-86c5-3661e62d4d1f' }
            break
          case 'restrict_proctoring_data': {
            const until = new Date(this.now.getTime() + 180 * 86_400_000)
            this.proctoring = { userId: null, anonymousSubjectId: '0232689c-4a5d-42a2-86c5-3661e62d4d1f' }
            return { processedCount: 1, nextCursor: null, done: true, restrictedRetentionUntil: until.toISOString() }
          }
          case 'delete_account': {
            const prerequisitesComplete = this.steps
              .filter(step => !['delete_account', 'sync_deletion_manifest'].includes(step.stepCode))
              .every(step => step.status === 'COMPLETED' || (step.status === 'HELD' && step.action === 'RESTRICTED_RETENTION'))
            if (!prerequisitesComplete || this.examArchive.userId !== null || this.proctoring.userId !== null) {
              throw Object.assign(new Error('删除前置条件未完成'), {
                code: 'LIFECYCLE_PREREQUISITE_INCOMPLETE',
                recoverable: false,
              })
            }
            if (this.record && this.user) {
              await this.manifest.append(createManifestEntry({
                requestId: this.record.requestId,
                dataRegion: this.record.dataRegion,
                publicId: PUBLIC_ID,
                key: MANIFEST_KEY,
                keyVersion: 'v1',
                completedAt: this.now,
              }))
              this.receipt = {
                requestId: this.record.requestId,
                outcome: this.activeHoldUntil ? 'COMPLETED_WITH_RESTRICTED_RETENTION' : 'COMPLETED',
                policyVersion: this.record.policyVersion,
                completedAt: this.now.toISOString(),
              }
              this.record.userId = null
              this.user = null
            }
            break
          }
          case 'sync_deletion_manifest':
            this.manifestSynced = true
            this.outbox.recipientEnvelope = ''
            this.outbox.payloadEnvelope = ''
            this.outbox.status = 'SENT'
            break
        }
        return { processedCount: 1, nextCursor: null, done: true }
      },
    }
  }

  async request(mode: DeletionMode, requestId = REQUEST_ID) {
    return this.account.request(7, {
      requestId,
      mode,
      statusToken: STATUS_TOKEN,
      password: 'correct-password',
      confirmationPhrase: '删除问衡账号',
    })
  }

  async runWorker(workerId = 'worker-a'): Promise<LifecycleWorkerRunSummary> {
    return runLifecycleWorkerOnce({
      repository: this,
      handlers: this.handlers,
      metrics: new MemoryLifecycleMetrics(),
      workerId,
      dataRegion: 'CN',
      now: this.now,
      leaseMs: 30_000,
      batchSize: 100,
    })
  }

  async runUntilIdle(): Promise<void> {
    for (let index = 0; index < 100; index += 1) {
      const result = await this.runWorker()
      if (result.retried) {
        const next = this.steps.find(step => step.nextAttemptAt)?.nextAttemptAt
        if (next) this.now = new Date(next)
      }
      if (!result.claimed && !result.paused) return
    }
    throw new Error('事务化内存生命周期系统未在限制轮次内空闲')
  }

  async findUserForReauthentication(userId: number) { return this.user?.id === userId ? clone(this.user) : null }
  async findUserByEmailForReauthentication(email: string) { return this.user?.email === email ? clone(this.user) : null }

  async createOrReplay(input: CreateDeletionRequestInput): Promise<CreateDeletionRequestResult> {
    if (this.record) {
      if (this.record.requestId !== input.requestId || this.record.requestDigest !== input.requestDigest) {
        throw new HttpError('请求编号已用于不同注销申请', 409, { code: 'LIFECYCLE_REQUEST_CONFLICT' })
      }
      return { record: this.snapshot()!, replayed: true, revokedSessionIds: [] }
    }
    this.steps = input.steps.map((step, index) => ({
      ...step,
      stepId: `a${String(index).padStart(2, '0')}2689c-4a5d-42a2-86c5-3661e62d4d1f`,
      status: 'PENDING',
      plannedCount: 0,
      processedCount: 0,
      attemptCount: 0,
      lastErrorCode: null,
      leaseOwner: null,
      leaseExpiresAt: null,
      nextAttemptAt: null,
    }))
    this.record = {
      requestId: input.requestId,
      userId: input.userId,
      dataRegion: input.dataRegion,
      mode: input.mode,
      status: 'SCHEDULED',
      requestDigest: input.requestDigest,
      policyVersion: input.policySnapshot.version,
      policySnapshot: clone(input.policySnapshot),
      statusTokenDigest: input.statusTokenDigest,
      retentionSummary: clone(input.retentionSummary),
      requestedAt: input.now.toISOString(),
      scheduledFor: input.scheduledFor.toISOString(),
      startedAt: null,
      cancelledAt: null,
      completedAt: null,
      restrictedRetentionUntil: null,
      steps: [],
    }
    if (this.user) this.user.deletionStatus = 'SCHEDULED'
    return { record: this.snapshot()!, replayed: false, revokedSessionIds: ['session-1', 'session-2'] }
  }

  async findByStatusCredential(requestId: string) { return this.record?.requestId === requestId ? this.snapshot() : null }
  async findLatestByUser(userId: number) { return this.record?.userId === userId ? this.snapshot() : null }

  async cancelGraceRequest(userId: number, now: Date): Promise<AccountDeletionRecord> {
    if (!this.record || this.record.userId !== userId) throw new HttpError('没有可取消的注销申请', 404, { code: 'NOT_FOUND' })
    if (this.record.mode !== 'GRACE_PERIOD' || this.record.startedAt || !['REQUESTED', 'SCHEDULED'].includes(this.record.status)) {
      throw new HttpError('注销申请已进入不可逆阶段', 409, { code: 'LIFECYCLE_ALREADY_IRREVERSIBLE' })
    }
    this.record.status = 'CANCELLED'
    this.record.cancelledAt = now.toISOString()
    this.steps = []
    if (this.user) this.user.deletionStatus = 'ACTIVE'
    return this.snapshot()!
  }

  async releaseExpiredLeases(now: Date): Promise<number> {
    let takeovers = 0
    const holdActive = Boolean(this.activeHoldUntil && this.activeHoldUntil > now)
    for (const step of this.steps) {
      if (holdActive && step.category === 'PROCTORING_AND_IDENTITY' && ['PENDING', 'RETRYING'].includes(step.status)) {
        step.status = 'HELD'
        step.leaseOwner = null
        step.leaseExpiresAt = null
      } else if (!holdActive && step.status === 'HELD') {
        step.status = 'PENDING'
      }
      if (step.status === 'RUNNING' && step.leaseExpiresAt && step.leaseExpiresAt <= now) {
        step.status = 'RETRYING'
        step.leaseOwner = null
        step.leaseExpiresAt = null
        step.nextAttemptAt = now
        takeovers += 1
      }
    }
    this.syncParent()
    return takeovers
  }

  async isRegionPaused() { return false }

  async claimNextStep(workerId: string, now: Date, leaseMs: number): Promise<ClaimedLifecycleStep | null> {
    if (!this.record || this.record.status === 'CANCELLED' || new Date(this.record.scheduledFor) > now) return null
    const step = this.steps.find(candidate =>
      ['PENDING', 'RETRYING'].includes(candidate.status) &&
      (!candidate.nextAttemptAt || candidate.nextAttemptAt <= now) &&
      (!candidate.leaseExpiresAt || candidate.leaseExpiresAt <= now),
    )
    if (!step) return null
    step.status = 'RUNNING'
    step.leaseOwner = workerId
    step.leaseExpiresAt = new Date(now.getTime() + leaseMs)
    this.syncParent()
    return {
      stepId: step.stepId,
      stepCode: step.stepCode,
      category: step.category,
      action: step.action,
      dataRegion: this.record.dataRegion,
      parent: { kind: 'ACCOUNT_DELETION', requestId: this.record.requestId, userId: this.record.userId },
      policySnapshot: this.record.policySnapshot,
      cursor: null,
      plannedCount: step.plannedCount,
      processedCount: step.processedCount,
      attemptCount: step.attemptCount,
      status: 'RUNNING',
    }
  }

  async renewLease(workerId: string, stepId: string, now: Date, leaseMs: number) {
    const step = this.steps.find(candidate => candidate.stepId === stepId && candidate.leaseOwner === workerId)
    if (!step) throw Object.assign(new Error('租约冲突'), { code: 'LIFECYCLE_LEASE_CONFLICT' })
    step.leaseExpiresAt = new Date(now.getTime() + leaseMs)
  }

  async completeBatch(workerId: string, completion: LifecycleBatchCompletion) {
    const step = this.steps.find(candidate => candidate.stepId === completion.stepId && candidate.leaseOwner === workerId)
    if (!step) throw Object.assign(new Error('租约冲突'), { code: 'LIFECYCLE_LEASE_CONFLICT' })
    step.plannedCount = Math.max(step.plannedCount, Number(completion.plannedCount ?? 0))
    step.processedCount += completion.processedCount
    step.status = completion.done ? 'COMPLETED' : 'PENDING'
    step.leaseOwner = null
    step.leaseExpiresAt = null
    step.nextAttemptAt = null
    step.lastErrorCode = null
    if (completion.restrictedRetentionUntil) {
      this.activeHoldUntil = new Date(completion.restrictedRetentionUntil)
    }
    this.syncParent()
  }

  async markRetry(workerId: string, input: { stepId: string; errorCode: string; now: Date; maxAttempts: number }) {
    const step = this.steps.find(candidate => candidate.stepId === input.stepId && candidate.leaseOwner === workerId)
    if (!step) throw Object.assign(new Error('租约冲突'), { code: 'LIFECYCLE_LEASE_CONFLICT' })
    step.attemptCount += 1
    step.leaseOwner = null
    step.leaseExpiresAt = null
    step.lastErrorCode = input.errorCode
    if (step.attemptCount >= input.maxAttempts) {
      step.status = 'ATTENTION_REQUIRED'
      this.syncParent()
      return 'ATTENTION_REQUIRED' as const
    }
    step.status = 'RETRYING'
    step.nextAttemptAt = new Date(input.now.getTime() + 1_000 * 2 ** (step.attemptCount - 1))
    this.syncParent()
    return 'RETRYING' as const
  }

  async markAttention(workerId: string, stepId: string, errorCode: string) {
    const step = this.steps.find(candidate => candidate.stepId === stepId && candidate.leaseOwner === workerId)
    if (!step) throw Object.assign(new Error('租约冲突'), { code: 'LIFECYCLE_LEASE_CONFLICT' })
    step.status = 'ATTENTION_REQUIRED'
    step.lastErrorCode = errorCode
    step.leaseOwner = null
    step.leaseExpiresAt = null
    this.syncParent()
  }
}

test('立即注销执行到去身份完成状态且状态凭证不泄露内部身份', async () => {
  const system = new TransactionalMemoryLifecycleSystem()
  await system.request('IMMEDIATE')
  await system.runUntilIdle()

  assert.equal(system.user, null)
  assert.equal(system.authCredentialCount, 0)
  assert.equal(system.faceCredentialCount, 0)
  assert.equal(system.examArchive.userId, null)
  assert.equal(system.proctoring.userId, null)
  assert.equal(system.manifestSynced, true)
  assert.equal(system.record?.status, 'COMPLETED_WITH_RESTRICTED_RETENTION')
  assert.ok(system.record?.restrictedRetentionUntil)
  assert.doesNotMatch(JSON.stringify(system.receipt), /user@example\.com|fa0d8c4e|userId|anonymousSubjectId/)

  const status = await system.account.status({ requestId: REQUEST_ID, statusToken: STATUS_TOKEN })
  assert.equal(status.status, 'COMPLETED_WITH_RESTRICTED_RETENTION')
  assert.doesNotMatch(JSON.stringify(status), new RegExp(`${STATUS_TOKEN}|userId|statusTokenDigest|anonymousSubjectId`))
})

test('三十天注销在计划时间前不执行且可重新认证取消', async () => {
  const system = new TransactionalMemoryLifecycleSystem()
  const created = await system.request('GRACE_PERIOD')
  assert.equal(created.cancellable, true)
  assert.equal((await system.runWorker()).claimed, 0)
  const cancelled = await system.account.cancel({ email: 'user@example.com', password: 'correct-password' })
  assert.equal(cancelled.status, 'CANCELLED')
  assert.ok(system.user)
  assert.equal(system.faceCredentialCount, 1)
})

test('Worker 可从暂时故障和过期租约恢复且两个 Worker 不会同时认领', async () => {
  const leaseSystem = new TransactionalMemoryLifecycleSystem()
  await leaseSystem.request('IMMEDIATE')
  leaseSystem.steps.splice(1)
  const first = await leaseSystem.claimNextStep('worker-a', leaseSystem.now, 30_000)
  assert.ok(first)
  assert.equal(await leaseSystem.claimNextStep('worker-b', leaseSystem.now, 30_000), null)
  leaseSystem.now = new Date(leaseSystem.now.getTime() + 30_001)
  assert.equal(await leaseSystem.releaseExpiredLeases(leaseSystem.now), 1)
  assert.equal((await leaseSystem.claimNextStep('worker-b', leaseSystem.now, 30_000))?.stepId, first?.stepId)

  const system = new TransactionalMemoryLifecycleSystem()
  await system.request('IMMEDIATE')
  system.failOnce.add('anonymize_user_content')
  let sawRetry = false
  for (let index = 0; index < 20 && !sawRetry; index += 1) {
    const summary = await system.runWorker()
    sawRetry = summary.retried === 1
  }
  assert.equal(sawRetry, true)
  const retryAt = system.steps.find(step => step.stepCode === 'anonymize_user_content')?.nextAttemptAt
  assert.ok(retryAt)
  system.now = new Date(retryAt!)
  await system.runUntilIdle()
  assert.match(String(system.record?.status), /^COMPLETED/)
})

test('未知数据列和未知处理器失败关闭，期限扫描遵守到期与冻结', async () => {
  assert.throws(
    () => assertLifecycleSchemaCovered([
      { tableName: 'unknown_subject_rows', columnName: 'user_id', referencedTableName: 'users' },
    ]),
    (error: unknown) => error instanceof LifecycleDatasetCoverageError,
  )
  const system = new TransactionalMemoryLifecycleSystem()
  await system.request('IMMEDIATE')
  system.handlers.delete('delete_auth_credentials')
  const result = await system.runWorker()
  assert.equal(result.attentionRequired, 1)
  assert.equal(system.record?.status, 'ATTENTION_REQUIRED')

  const now = new Date('2026-08-31T08:00:00.000Z')
  assert.equal(isRetentionEligible({ retainUntil: new Date('2026-08-30T00:00:00.000Z'), now }), true)
  assert.equal(isRetentionEligible({
    retainUntil: new Date('2026-08-30T00:00:00.000Z'),
    activeHoldUntil: new Date('2026-09-01T00:00:00.000Z'),
    now,
  }), false)
})

test('完成通知清除密文且墓碑可清理旧备份恢复的账号', async () => {
  const system = new TransactionalMemoryLifecycleSystem()
  await system.request('IMMEDIATE')
  await system.runUntilIdle()
  assert.deepEqual(system.outbox, { recipientEnvelope: '', payloadEnvelope: '', status: 'SENT' })
  assert.doesNotMatch(JSON.stringify(await system.manifest.list()), /fa0d8c4e/)

  const restored = {
    users: [{ publicId: PUBLIC_ID, dataRegion: 'CN' as const }],
    async listSubjects(input: { dataRegion: 'CN' | 'GLOBAL'; afterPublicId: string | null; limit: number }) {
      return this.users
        .filter(user => user.dataRegion === input.dataRegion && (!input.afterPublicId || user.publicId > input.afterPublicId))
        .slice(0, input.limit)
        .map(user => ({ publicId: user.publicId }))
    },
    async deleteSubjects(dataRegion: 'CN' | 'GLOBAL', publicIds: readonly string[]) {
      const before = this.users.length
      this.users = this.users.filter(user => user.dataRegion !== dataRegion || !publicIds.includes(user.publicId))
      return before - this.users.length
    },
  }
  const replay = await replayDeletionManifest(system.manifest, restored, { v1: MANIFEST_KEY })
  assert.equal(replay.deletedSubjects, 1)
  assert.equal(restored.users.length, 0)
})
