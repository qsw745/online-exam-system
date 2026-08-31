import assert from 'node:assert/strict'
import test from 'node:test'

import HttpError from '@/common/errors/http-error'
import {
  digestDeletionStatusToken,
} from '@/modules/privacy-lifecycle/domain/lifecycle.policy'
import type {
  AccountDeletionRecord,
  AccountDeletionRepositoryContract,
  AccountDeletionUser,
  CreateDeletionRequestInput,
  CreateDeletionRequestResult,
} from '../domain/account-deletion.model'
import { AccountDeletionService } from './account-deletion.service'

const REQUEST_ID = '1132689c-4a5d-42a2-86c5-3661e62d4d1f'
const SECOND_REQUEST_ID = '3132689c-4a5d-42a2-86c-3661e62d4d1f'.replace('-86c-', '-86c5-')
const STATUS_TOKEN = Buffer.alloc(32, 7).toString('base64url')

const clone = <T>(value: T): T => structuredClone(value)

class MemoryAccountDeletionRepository implements AccountDeletionRepositoryContract {
  readonly requests: AccountDeletionRecord[] = []
  readonly outboxKeys: string[] = []
  readonly notificationRecipients: string[] = []
  activeSessionCount = 2

  constructor(readonly user: AccountDeletionUser) {}

  async findUserForReauthentication(userId: number): Promise<AccountDeletionUser | null> {
    return this.user.id === userId ? clone(this.user) : null
  }

  async findUserByEmailForReauthentication(email: string): Promise<AccountDeletionUser | null> {
    return this.user.email === email ? clone(this.user) : null
  }

  async createOrReplay(input: CreateDeletionRequestInput): Promise<CreateDeletionRequestResult> {
    const byRequestId = this.requests.find(request => request.requestId === input.requestId)
    if (byRequestId) {
      if (byRequestId.requestDigest !== input.requestDigest) {
        throw new HttpError('请求编号已用于不同注销申请', 409, { code: 'LIFECYCLE_REQUEST_CONFLICT' })
      }
      return { record: clone(byRequestId), replayed: true, revokedSessionIds: [] }
    }
    if (!['ACTIVE', 'CANCELLED'].includes(this.user.deletionStatus)) {
      throw new HttpError('账号已有进行中的注销申请', 409, { code: 'LIFECYCLE_REQUEST_CONFLICT' })
    }

    const record: AccountDeletionRecord = {
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
      steps: input.steps.map(step => ({ ...step, status: 'PENDING', attemptCount: 0 })),
    }
    this.requests.push(record)
    this.outboxKeys.push(`deletion-requested:${input.requestId}`)
    this.notificationRecipients.push(input.notificationEmail)
    this.user.deletionStatus = 'SCHEDULED'
    const revokedSessionIds = Array.from({ length: this.activeSessionCount }, (_, index) => `session-${index + 1}`)
    this.activeSessionCount = 0
    return { record: clone(record), replayed: false, revokedSessionIds }
  }

  async findByStatusCredential(requestId: string): Promise<AccountDeletionRecord | null> {
    const record = this.requests.find(request => request.requestId === requestId)
    return record ? clone(record) : null
  }

  async findLatestByUser(userId: number): Promise<AccountDeletionRecord | null> {
    const records = this.requests.filter(request => request.userId === userId)
    return records.length ? clone(records[records.length - 1]!) : null
  }

  async cancelGraceRequest(userId: number, now: Date): Promise<AccountDeletionRecord> {
    const record = [...this.requests].reverse().find(request => request.userId === userId)
    if (!record) throw new HttpError('没有可取消的注销申请', 404, { code: 'NOT_FOUND' })
    if (record.mode !== 'GRACE_PERIOD' || record.startedAt || !['REQUESTED', 'SCHEDULED'].includes(record.status)) {
      throw new HttpError('注销申请已进入不可逆阶段', 409, { code: 'LIFECYCLE_ALREADY_IRREVERSIBLE' })
    }
    record.status = 'CANCELLED'
    record.cancelledAt = now.toISOString()
    record.steps = []
    this.user.deletionStatus = 'ACTIVE'
    this.outboxKeys.push(`deletion-cancelled:${record.requestId}`)
    this.notificationRecipients.push(this.user.email)
    return clone(record)
  }
}

const activeUser = (overrides: Partial<AccountDeletionUser> = {}): AccountDeletionUser => ({
  id: 7,
  email: 'user@example.com',
  passwordHash: 'stored-password-hash',
  dataRegion: 'CN',
  accountType: 'PERSONAL',
  deletionStatus: 'ACTIVE',
  ...overrides,
})

const createService = (repository: MemoryAccountDeletionRepository, revoked: string[] = []) =>
  new AccountDeletionService(repository, () => new Date('2026-08-31T08:00:00.000Z'), {
    verifyPassword: (plain, hash) => plain === 'correct-password' && hash === 'stored-password-hash',
    revokeSession: async sessionId => {
      revoked.push(sessionId)
    },
  })

test('立即删除冻结账号、撤销会话并只保存客户端状态令牌摘要', async () => {
  const repository = new MemoryAccountDeletionRepository(activeUser())
  const revoked: string[] = []
  const service = createService(repository, revoked)

  const result = await service.request(7, {
    requestId: REQUEST_ID,
    mode: 'IMMEDIATE',
    statusToken: STATUS_TOKEN,
    password: 'correct-password',
    confirmationPhrase: '删除问衡账号',
  })

  assert.equal(result.status, 'SCHEDULED')
  assert.equal(result.scheduledFor, '2026-08-31T08:00:00.000Z')
  assert.equal(result.statusToken, STATUS_TOKEN)
  assert.equal(repository.requests[0]?.statusTokenDigest, digestDeletionStatusToken(STATUS_TOKEN))
  assert.equal(JSON.stringify(repository.requests).includes(STATUS_TOKEN), false)
  assert.equal(repository.user.deletionStatus, 'SCHEDULED')
  assert.equal(repository.activeSessionCount, 0)
  assert.deepEqual(repository.outboxKeys, [`deletion-requested:${REQUEST_ID}`])
  assert.deepEqual(repository.notificationRecipients, ['user@example.com'])
  assert.deepEqual(revoked, ['session-1', 'session-2'])
})

test('三十天模式固化计划时间且执行前可重新认证取消', async () => {
  const repository = new MemoryAccountDeletionRepository(activeUser())
  const service = createService(repository)

  const created = await service.request(7, {
    requestId: REQUEST_ID,
    mode: 'GRACE_PERIOD',
    statusToken: STATUS_TOKEN,
    password: 'correct-password',
    confirmationPhrase: '删除问衡账号',
  })
  assert.equal(created.scheduledFor, '2026-09-30T08:00:00.000Z')
  assert.equal(created.cancellable, true)

  const cancelled = await service.cancel({ email: 'user@example.com', password: 'correct-password' })
  assert.equal(cancelled.status, 'CANCELLED')
  assert.equal(cancelled.cancellable, false)
  assert.equal(repository.user.deletionStatus, 'ACTIVE')
  assert.deepEqual(repository.outboxKeys, [
    `deletion-requested:${REQUEST_ID}`,
    `deletion-cancelled:${REQUEST_ID}`,
  ])
})

test('立即删除和已开始执行的宽限请求都不能取消', async () => {
  const immediateRepository = new MemoryAccountDeletionRepository(activeUser())
  const immediateService = createService(immediateRepository)
  await immediateService.request(7, {
    requestId: REQUEST_ID,
    mode: 'IMMEDIATE',
    statusToken: STATUS_TOKEN,
    password: 'correct-password',
    confirmationPhrase: '删除问衡账号',
  })
  await assert.rejects(
    () => immediateService.cancel({ email: 'user@example.com', password: 'correct-password' }),
    (error: unknown) => error instanceof HttpError && error.code === 'LIFECYCLE_ALREADY_IRREVERSIBLE',
  )

  const graceRepository = new MemoryAccountDeletionRepository(activeUser())
  const graceService = createService(graceRepository)
  await graceService.request(7, {
    requestId: REQUEST_ID,
    mode: 'GRACE_PERIOD',
    statusToken: STATUS_TOKEN,
    password: 'correct-password',
    confirmationPhrase: '删除问衡账号',
  })
  graceRepository.requests[0]!.status = 'RUNNING'
  graceRepository.requests[0]!.startedAt = '2026-08-31T08:01:00.000Z'
  await assert.rejects(
    () => graceService.cancel({ email: 'user@example.com', password: 'correct-password' }),
    (error: unknown) => error instanceof HttpError && error.code === 'LIFECYCLE_ALREADY_IRREVERSIBLE',
  )
})

test('网络不确定重试复用相同语义，复用编号但改变模式会冲突', async () => {
  const repository = new MemoryAccountDeletionRepository(activeUser())
  const service = createService(repository)
  const input = {
    requestId: REQUEST_ID,
    mode: 'GRACE_PERIOD' as const,
    statusToken: STATUS_TOKEN,
    password: 'correct-password',
    confirmationPhrase: '删除问衡账号',
  }

  const first = await service.request(7, input)
  const replay = await service.request(7, input)
  assert.equal(first.requestId, replay.requestId)
  assert.equal(repository.requests.length, 1)
  assert.deepEqual(repository.outboxKeys, [`deletion-requested:${REQUEST_ID}`])

  await assert.rejects(
    () => service.request(7, { ...input, mode: 'IMMEDIATE' }),
    (error: unknown) => error instanceof HttpError && error.code === 'LIFECYCLE_REQUEST_CONFLICT',
  )
})

test('账号行删除后仍可用状态令牌查询且响应不暴露内部身份', async () => {
  const repository = new MemoryAccountDeletionRepository(activeUser())
  const service = createService(repository)
  await service.request(7, {
    requestId: REQUEST_ID,
    mode: 'IMMEDIATE',
    statusToken: STATUS_TOKEN,
    password: 'correct-password',
    confirmationPhrase: '删除问衡账号',
  })
  repository.requests[0]!.userId = null
  repository.requests[0]!.status = 'COMPLETED'
  repository.requests[0]!.completedAt = '2026-08-31T08:03:00.000Z'

  const status = await service.status({ requestId: REQUEST_ID, statusToken: STATUS_TOKEN })
  const serialized = JSON.stringify(status)
  assert.equal(status.status, 'COMPLETED')
  assert.equal(serialized.includes('userId'), false)
  assert.equal(serialized.includes('statusTokenDigest'), false)
  assert.equal(serialized.includes('anonymousSubject'), false)
  assert.equal(serialized.includes(STATUS_TOKEN), false)
})

test('错误密码、缺失区域和错误状态令牌使用稳定错误码', async () => {
  const repository = new MemoryAccountDeletionRepository(activeUser())
  const service = createService(repository)
  await assert.rejects(
    () => service.request(7, {
      requestId: SECOND_REQUEST_ID,
      mode: 'IMMEDIATE',
      statusToken: STATUS_TOKEN,
      password: 'wrong-password',
      confirmationPhrase: '删除问衡账号',
    }),
    (error: unknown) => error instanceof HttpError && error.code === 'AUTH_BAD_CREDENTIALS',
  )

  const missingRegionService = createService(
    new MemoryAccountDeletionRepository(activeUser({ dataRegion: undefined })),
  )
  await assert.rejects(
    () => missingRegionService.request(7, {
      requestId: REQUEST_ID,
      mode: 'IMMEDIATE',
      statusToken: STATUS_TOKEN,
      password: 'correct-password',
      confirmationPhrase: '删除问衡账号',
    }),
    (error: unknown) => error instanceof HttpError && error.code === 'SERVICE_REGION_MISMATCH',
  )

  await service.request(7, {
    requestId: REQUEST_ID,
    mode: 'IMMEDIATE',
    statusToken: STATUS_TOKEN,
    password: 'correct-password',
    confirmationPhrase: '删除问衡账号',
  })
  await assert.rejects(
    () => service.status({ requestId: REQUEST_ID, statusToken: Buffer.alloc(32, 8).toString('base64url') }),
    (error: unknown) => error instanceof HttpError && error.code === 'LIFECYCLE_STATUS_TOKEN_INVALID',
  )
})
