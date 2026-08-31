import type {
  DataRegion,
  LifecycleCategoryCode,
  LifecyclePolicySnapshot,
  LifecycleStepStatus,
  RetentionAction,
} from '../domain/lifecycle.model'
import type { LifecycleMetrics } from './lifecycle-observability'

export type LifecycleCursor = { afterId: string | number }

export type LifecycleParentContext =
  | { kind: 'ACCOUNT_DELETION'; requestId: string; userId: number | null }
  | { kind: 'RETENTION_SCAN'; scanRunId: string; windowStart: Date; windowEnd: Date }

export interface LifecycleTransaction {
  query(sql: string, params?: unknown[]): Promise<[unknown[], unknown]>
}

export interface LifecycleConnectionFactory {
  withTransaction<T>(operation: (connection: LifecycleTransaction) => Promise<T>): Promise<T>
}

export type LifecycleHandlerContext = {
  parent: LifecycleParentContext
  dataRegion: DataRegion
  policySnapshot: LifecyclePolicySnapshot | null
  cursor: LifecycleCursor | null
  batchSize: number
  now: Date
  connectionFactory?: LifecycleConnectionFactory
}

export type LifecycleBatchResult = {
  processedCount: number
  nextCursor: LifecycleCursor | null
  done: boolean
  restrictedRetentionUntil?: string | null
}

export interface LifecycleHandler {
  readonly stepCode: string
  readonly category: LifecycleCategoryCode
  planCount(context: LifecycleHandlerContext): Promise<number>
  executeBatch(context: LifecycleHandlerContext): Promise<LifecycleBatchResult>
}

export type ClaimedLifecycleStep = {
  stepId: string
  stepCode: string
  category: LifecycleCategoryCode
  action: RetentionAction
  dataRegion: DataRegion
  parent: LifecycleParentContext
  policySnapshot: LifecyclePolicySnapshot | null
  cursor: LifecycleCursor | null
  plannedCount: number
  processedCount: number
  attemptCount: number
  status: LifecycleStepStatus
}

export type LifecycleBatchCompletion = LifecycleBatchResult & {
  stepId: string
  plannedCount?: number
}

export interface LifecycleWorkerRepositoryContract {
  releaseExpiredLeases(now: Date, dataRegion?: DataRegion): Promise<number>
  isRegionPaused(dataRegion: DataRegion): Promise<boolean>
  claimNextStep(workerId: string, now: Date, leaseMs: number, dataRegion?: DataRegion): Promise<ClaimedLifecycleStep | null>
  renewLease(workerId: string, stepId: string, now: Date, leaseMs: number): Promise<void>
  completeBatch(workerId: string, completion: LifecycleBatchCompletion): Promise<void>
  markRetry(
    workerId: string,
    input: { stepId: string; errorCode: string; now: Date; maxAttempts: number },
  ): Promise<'RETRYING' | 'ATTENTION_REQUIRED'>
  markAttention(workerId: string, stepId: string, errorCode: string): Promise<void>
}

export type LifecycleWorkerRunSummary = {
  claimed: number
  completed: number
  retried: number
  attentionRequired: number
  paused: boolean
}

export type LifecycleWorkerOptions = {
  repository: LifecycleWorkerRepositoryContract
  handlers: ReadonlyMap<string, LifecycleHandler>
  metrics: LifecycleMetrics
  workerId: string
  dataRegion: DataRegion
  now: Date
  leaseMs: number
  batchSize: number
  maxAttempts?: number
  connectionFactory?: LifecycleConnectionFactory
}

const EMPTY: LifecycleWorkerRunSummary = {
  claimed: 0,
  completed: 0,
  retried: 0,
  attentionRequired: 0,
  paused: false,
}

const stableErrorCode = (error: unknown): string => {
  const value = String((error as { code?: unknown })?.code ?? '')
  return /^LIFECYCLE_[A-Z0-9_]{1,80}$/.test(value) ? value : 'LIFECYCLE_HANDLER_FAILED'
}

export async function runLifecycleWorkerOnce(options: LifecycleWorkerOptions): Promise<LifecycleWorkerRunSummary> {
  const takeovers = await options.repository.releaseExpiredLeases(options.now, options.dataRegion)
  if (takeovers > 0) {
    options.metrics.record('lifecycle_lease_takeovers', takeovers, { dataRegion: options.dataRegion })
  }
  if (await options.repository.isRegionPaused(options.dataRegion)) {
    options.metrics.record('lifecycle_worker_runs', 1, { dataRegion: options.dataRegion, status: 'HELD' })
    return { ...EMPTY, paused: true }
  }

  const step = await options.repository.claimNextStep(
    options.workerId,
    options.now,
    options.leaseMs,
    options.dataRegion,
  )
  if (!step) return { ...EMPTY }

  const base = { dataRegion: step.dataRegion, category: step.category }
  const handler = options.handlers.get(step.stepCode)
  if (!handler || handler.category !== step.category) {
    await options.repository.markAttention(
      options.workerId,
      step.stepId,
      'LIFECYCLE_UNCLASSIFIED_DATASET',
    )
    options.metrics.record('lifecycle_handler_runs', 1, {
      ...base,
      status: 'ATTENTION_REQUIRED',
      errorCode: 'LIFECYCLE_UNCLASSIFIED_DATASET',
    })
    return { ...EMPTY, claimed: 1, attentionRequired: 1 }
  }

  const context: LifecycleHandlerContext = {
    parent: step.parent,
    dataRegion: step.dataRegion,
    policySnapshot: step.policySnapshot,
    cursor: step.cursor,
    batchSize: options.batchSize,
    now: options.now,
    connectionFactory: options.connectionFactory,
  }
  const startedAt = Date.now()
  try {
    await options.repository.renewLease(options.workerId, step.stepId, options.now, options.leaseMs)
    const plannedCount = step.plannedCount > 0 ? step.plannedCount : await handler.planCount(context)
    const result = await handler.executeBatch(context)
    await options.repository.completeBatch(options.workerId, {
      stepId: step.stepId,
      plannedCount,
      ...result,
    })
    options.metrics.record('lifecycle_handler_rows', result.processedCount, { ...base, status: 'SUCCESS' })
    options.metrics.record('lifecycle_handler_duration_ms', Math.max(0, Date.now() - startedAt), {
      ...base,
      status: 'SUCCESS',
    })
    return { ...EMPTY, claimed: 1, completed: result.done ? 1 : 0 }
  } catch (error) {
    const errorCode = stableErrorCode(error)
    if (errorCode === 'LIFECYCLE_LEASE_CONFLICT') throw error
    if ((error as { recoverable?: boolean })?.recoverable === false) {
      await options.repository.markAttention(options.workerId, step.stepId, errorCode)
      options.metrics.record('lifecycle_handler_runs', 1, {
        ...base,
        status: 'ATTENTION_REQUIRED',
        errorCode,
      })
      return { ...EMPTY, claimed: 1, attentionRequired: 1 }
    }
    const retryStatus = await options.repository.markRetry(options.workerId, {
      stepId: step.stepId,
      errorCode,
      now: options.now,
      maxAttempts: options.maxAttempts ?? 5,
    })
    const exhausted = retryStatus === 'ATTENTION_REQUIRED'
    options.metrics.record('lifecycle_handler_runs', 1, {
      ...base,
      status: exhausted ? 'ATTENTION_REQUIRED' : 'RETRY',
      errorCode: exhausted ? 'LIFECYCLE_STEP_RETRY_EXHAUSTED' : errorCode,
    })
    return {
      ...EMPTY,
      claimed: 1,
      retried: exhausted ? 0 : 1,
      attentionRequired: exhausted ? 1 : 0,
    }
  }
}
