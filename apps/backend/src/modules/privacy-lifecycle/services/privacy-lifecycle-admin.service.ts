import HttpError from '@/common/errors/http-error'
import { normalizeLifecycleUuid } from '../domain/lifecycle.policy'
import { normalizeRetentionHold, type RetentionHoldInput } from '../domain/retention-hold.policy'
import type { DataRegion } from '../domain/lifecycle.model'
import type { LifecycleHandler } from './lifecycle-worker.service'
import { ACCOUNT_DELETION_STEPS } from '@/modules/account/domain/account-deletion.model'

export type LifecycleAdminActor = { userId: number; role: string; dataRegion: DataRegion }

export interface PrivacyLifecycleAdminRepositoryContract {
  createHold(input: any): Promise<any>
  releaseHold(dataRegion: DataRegion, holdId: string, actorId: number, now: Date): Promise<any | null>
  extendHold(dataRegion: DataRegion, holdId: string, expiresAt: Date, actorId: number, now: Date): Promise<any | null>
  pauseRegion(dataRegion: DataRegion, reason: string, reviewAt: Date, actorId: number): Promise<void>
  resumeRegion(dataRegion: DataRegion, actorId: number): Promise<void>
  retryStep(dataRegion: DataRegion, stepId: string, now: Date): Promise<boolean>
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

  async createHold(actor: LifecycleAdminActor, input: RetentionHoldInput & { holdId: string }) {
    this.actor(actor)
    const now = this.dependencies.now?.() ?? new Date()
    const holdId = normalizeLifecycleUuid(input.holdId, '冻结编号')
    const normalized = normalizeRetentionHold(input, now)
    return this.dependencies.repository.createHold({ holdId, dataRegion: this.dependencies.dataRegion, ...normalized, createdBy: actor.userId, createdAt: now })
  }

  async releaseHold(actor: LifecycleAdminActor, holdIdValue: string) {
    this.actor(actor)
    const holdId = normalizeLifecycleUuid(holdIdValue, '冻结编号')
    const value = await this.dependencies.repository.releaseHold(this.dependencies.dataRegion, holdId, actor.userId, this.dependencies.now?.() ?? new Date())
    if (!value) throw new HttpError('冻结不存在', 404, { code: 'NOT_FOUND' })
    return value
  }

  async extendHold(actor: LifecycleAdminActor, holdIdValue: string, expiresAtValue: string) {
    this.actor(actor)
    const now = this.dependencies.now?.() ?? new Date()
    const expiresAt = new Date(expiresAtValue)
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= now || expiresAt.getTime() > now.getTime() + 365 * 86400000) throw new HttpError('冻结延期时间无效', 400, { code: 'LIFECYCLE_HOLD_EXPIRY_INVALID' })
    const value = await this.dependencies.repository.extendHold(this.dependencies.dataRegion, normalizeLifecycleUuid(holdIdValue, '冻结编号'), expiresAt, actor.userId, now)
    if (!value) throw new HttpError('冻结不存在', 404, { code: 'NOT_FOUND' })
    return value
  }

  async pauseRegion(actor: LifecycleAdminActor, input: { reason: string; reviewAt: string }) {
    this.actor(actor)
    const now = this.dependencies.now?.() ?? new Date()
    const reason = String(input.reason || '').trim()
    const reviewAt = new Date(input.reviewAt)
    if (!reason || reason.length > 500 || Number.isNaN(reviewAt.getTime()) || reviewAt <= now || reviewAt.getTime() > now.getTime() + 30 * 86400000) throw new HttpError('暂停原因或复核时间无效', 400, { code: 'LIFECYCLE_PAUSE_INVALID' })
    await this.dependencies.repository.pauseRegion(this.dependencies.dataRegion, reason, reviewAt, actor.userId)
    return { paused: true, reviewAt: reviewAt.toISOString() }
  }

  async resumeRegion(actor: LifecycleAdminActor) { this.actor(actor); await this.dependencies.repository.resumeRegion(this.dependencies.dataRegion, actor.userId); return { paused: false } }
  async retryStep(actor: LifecycleAdminActor, stepIdValue: string) { this.actor(actor); const stepId = normalizeLifecycleUuid(stepIdValue, '步骤编号'); const ok = await this.dependencies.repository.retryStep(this.dependencies.dataRegion, stepId, this.dependencies.now?.() ?? new Date()); if (!ok) throw new HttpError('步骤不存在或不可重试', 404, { code: 'NOT_FOUND' }); return { stepId, status: 'PENDING' } }
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
    const categories = []
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
      categories.push({ category: step.category, action: step.action, count })
    }
    return { coverage, categories }
  }
}
