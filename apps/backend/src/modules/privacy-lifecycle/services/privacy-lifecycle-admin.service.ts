import HttpError from '@/common/errors/http-error'
import { lifecycleRequestDigest, normalizeLifecycleUuid } from '../domain/lifecycle.policy'
import {
  canonicalizeRetentionHold,
  validateRetentionHoldWindow,
  type RetentionHoldInput,
} from '../domain/retention-hold.policy'
import type { DataRegion } from '../domain/lifecycle.model'
import type { LifecycleHandler } from './lifecycle-worker.service'
import { ACCOUNT_DELETION_STEPS } from '@/modules/account/domain/account-deletion.model'

export type LifecycleAdminActor = { userId: number; role: string; dataRegion: DataRegion }
export type LifecycleAdminOperation = { operationId: string; requestDigest: string }
export type LifecycleAdminOperationType = 'RELEASE_HOLD' | 'EXTEND_HOLD' | 'PAUSE_REGION' | 'RESUME_REGION' | 'RETRY_STEP'
export type LifecycleReplayResult = { found: boolean; result: any }

export interface PrivacyLifecycleAdminRepositoryContract {
  createHold(input: any): Promise<any>
  findHoldReplay(dataRegion: DataRegion, holdId: string, requestDigest: string): Promise<LifecycleReplayResult>
  findOperationReplay(dataRegion: DataRegion, operationType: LifecycleAdminOperationType, operation: LifecycleAdminOperation): Promise<LifecycleReplayResult>
  releaseHold(dataRegion: DataRegion, holdId: string, operation: LifecycleAdminOperation, actorId: number, now: Date): Promise<any | null>
  extendHold(dataRegion: DataRegion, holdId: string, operation: LifecycleAdminOperation, expiresAt: Date, actorId: number, now: Date): Promise<any | null>
  pauseRegion(dataRegion: DataRegion, operation: LifecycleAdminOperation, reason: string, reviewAt: Date, actorId: number): Promise<any>
  resumeRegion(dataRegion: DataRegion, operation: LifecycleAdminOperation, actorId: number): Promise<any>
  retryStep(dataRegion: DataRegion, stepId: string, operation: LifecycleAdminOperation, now: Date, actorId: number): Promise<any | null>
  listRequests(dataRegion: DataRegion, input?: any): Promise<any>
  getRequest(dataRegion: DataRegion, requestId: string): Promise<any | null>
  getDryRunContext?(dataRegion: DataRegion, requestId: string): Promise<any | null>
}

type SchemaAudit = { inspect(): Promise<any> }

export class PrivacyLifecycleAdminService {
  constructor(private readonly dependencies: {
    dataRegion: DataRegion
    repository: PrivacyLifecycleAdminRepositoryContract
    schemaAudit: SchemaAudit
    handlers: ReadonlyMap<string, LifecycleHandler>
    now?: () => Date
  }) {}

  private actor(actor: LifecycleAdminActor) {
    if (actor.role !== 'admin') throw new HttpError('仅管理员可执行该操作', 403, { code: 'FORBIDDEN' })
    if (actor.dataRegion !== this.dependencies.dataRegion) throw new HttpError('资源不存在', 404, { code: 'NOT_FOUND' })
  }

  private operation(operationIdValue: string, operationType: string, payload: Record<string, unknown>): LifecycleAdminOperation {
    const operationId = normalizeLifecycleUuid(operationIdValue, '操作编号')
    return {
      operationId,
      requestDigest: lifecycleRequestDigest({
        operationType,
        dataRegion: this.dependencies.dataRegion,
        ...payload,
      }),
    }
  }

  async createHold(actor: LifecycleAdminActor, input: RetentionHoldInput & { holdId: string }) {
    this.actor(actor)
    const now = this.dependencies.now?.() ?? new Date()
    const holdId = normalizeLifecycleUuid(input.holdId, '冻结编号')
    const normalized = canonicalizeRetentionHold(input)
    const replay = await this.dependencies.repository.findHoldReplay(
      this.dependencies.dataRegion,
      holdId,
      normalized.requestDigest,
    )
    if (replay.found) return replay.result
    validateRetentionHoldWindow(normalized.expiresAt, now)
    return this.dependencies.repository.createHold({ holdId, dataRegion: this.dependencies.dataRegion, ...normalized, createdBy: actor.userId, createdAt: now })
  }

  async releaseHold(actor: LifecycleAdminActor, holdIdValue: string, input: { operationId: string }) {
    this.actor(actor)
    const holdId = normalizeLifecycleUuid(holdIdValue, '冻结编号')
    const operation = this.operation(input.operationId, 'RELEASE_HOLD', { holdId })
    const value = await this.dependencies.repository.releaseHold(this.dependencies.dataRegion, holdId, operation, actor.userId, this.dependencies.now?.() ?? new Date())
    if (!value) throw new HttpError('冻结不存在', 404, { code: 'NOT_FOUND' })
    return value
  }

  async extendHold(actor: LifecycleAdminActor, holdIdValue: string, input: { operationId: string; expiresAt: string }) {
    this.actor(actor)
    const now = this.dependencies.now?.() ?? new Date()
    const holdId = normalizeLifecycleUuid(holdIdValue, '冻结编号')
    const expiresAt = new Date(input.expiresAt)
    if (Number.isNaN(expiresAt.getTime())) throw new HttpError('冻结延期时间无效', 400, { code: 'LIFECYCLE_HOLD_EXPIRY_INVALID' })
    const operation = this.operation(input.operationId, 'EXTEND_HOLD', { holdId, expiresAt: expiresAt.toISOString() })
    const replay = await this.dependencies.repository.findOperationReplay(
      this.dependencies.dataRegion,
      'EXTEND_HOLD',
      operation,
    )
    if (replay.found) return replay.result
    if (expiresAt <= now || expiresAt.getTime() > now.getTime() + 365 * 86400000) throw new HttpError('冻结延期时间无效', 400, { code: 'LIFECYCLE_HOLD_EXPIRY_INVALID' })
    const value = await this.dependencies.repository.extendHold(this.dependencies.dataRegion, holdId, operation, expiresAt, actor.userId, now)
    if (!value) throw new HttpError('冻结不存在', 404, { code: 'NOT_FOUND' })
    return value
  }

  async pauseRegion(actor: LifecycleAdminActor, input: { operationId: string; reason: string; reviewAt: string }) {
    this.actor(actor)
    const now = this.dependencies.now?.() ?? new Date()
    const reason = String(input.reason || '').trim()
    const reviewAt = new Date(input.reviewAt)
    if (!reason || reason.length > 500 || Number.isNaN(reviewAt.getTime())) throw new HttpError('暂停原因或复核时间无效', 400, { code: 'LIFECYCLE_PAUSE_INVALID' })
    const operation = this.operation(input.operationId, 'PAUSE_REGION', { reason, reviewAt: reviewAt.toISOString() })
    const replay = await this.dependencies.repository.findOperationReplay(
      this.dependencies.dataRegion,
      'PAUSE_REGION',
      operation,
    )
    if (replay.found) return replay.result
    if (reviewAt <= now || reviewAt.getTime() > now.getTime() + 30 * 86400000) throw new HttpError('暂停原因或复核时间无效', 400, { code: 'LIFECYCLE_PAUSE_INVALID' })
    return this.dependencies.repository.pauseRegion(this.dependencies.dataRegion, operation, reason, reviewAt, actor.userId)
  }

  async resumeRegion(actor: LifecycleAdminActor, input: { operationId: string }) {
    this.actor(actor)
    const operation = this.operation(input.operationId, 'RESUME_REGION', {})
    return this.dependencies.repository.resumeRegion(this.dependencies.dataRegion, operation, actor.userId)
  }

  async retryStep(actor: LifecycleAdminActor, stepIdValue: string, input: { operationId: string }) {
    this.actor(actor)
    const stepId = normalizeLifecycleUuid(stepIdValue, '步骤编号')
    const operation = this.operation(input.operationId, 'RETRY_STEP', { stepId })
    const value = await this.dependencies.repository.retryStep(
      this.dependencies.dataRegion,
      stepId,
      operation,
      this.dependencies.now?.() ?? new Date(),
      actor.userId,
    )
    if (!value) throw new HttpError('步骤不存在或不可重试', 404, { code: 'NOT_FOUND' })
    return value
  }
  async listRequests(actor: LifecycleAdminActor, input?: any) { this.actor(actor); return this.dependencies.repository.listRequests(this.dependencies.dataRegion, input) }
  async getRequest(actor: LifecycleAdminActor, requestIdValue: string) { this.actor(actor); const value = await this.dependencies.repository.getRequest(this.dependencies.dataRegion, normalizeLifecycleUuid(requestIdValue, '请求编号')); if (!value) throw new HttpError('请求不存在', 404, { code: 'NOT_FOUND' }); return value }
  async dryRun(actor: LifecycleAdminActor, input?: { requestId?: string }) {
    this.actor(actor)
    const coverage = await this.dependencies.schemaAudit.inspect()
    if (!input?.requestId || !this.dependencies.repository.getDryRunContext) return { coverage, categories: [] as any[] }
    const requestId = normalizeLifecycleUuid(input.requestId, '请求编号')
    const parent = await this.dependencies.repository.getDryRunContext(this.dependencies.dataRegion, requestId)
    if (!parent) throw new HttpError('请求不存在', 404, { code: 'NOT_FOUND' })
    const stepByCode = new Map(ACCOUNT_DELETION_STEPS.map(step => [step.stepCode, step]))
    const aggregated = new Map<string, { category: string; action: string; count: number }>()
    for (const handler of this.dependencies.handlers.values()) {
      if (handler.stepCode === 'delete_account' || handler.stepCode === 'sync_deletion_manifest') continue
      const step = stepByCode.get(handler.stepCode)
      if (!step) continue
      const count = await handler.planCount({
        parent: { kind: 'ACCOUNT_DELETION', requestId, userId: Number(parent.userId) },
        dataRegion: this.dependencies.dataRegion,
        policySnapshot: parent.policySnapshot,
        cursor: null,
        batchSize: 100,
        now: this.dependencies.now?.() ?? new Date(),
      })
      const key = `${step.category}:${step.action}`
      const current = aggregated.get(key)
      if (current) current.count += count
      else aggregated.set(key, { category: step.category, action: step.action, count })
    }
    return { coverage, categories: [...aggregated.values()] }
  }
}
